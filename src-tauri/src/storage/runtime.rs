use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use thiserror::Error;

use super::{Database, StorageError};

pub const DATABASE_FILE_NAME: &str = "smartspace.sqlite3";

#[derive(Debug, Error)]
pub enum DatabaseRuntimeError {
    #[error("failed to create user data directory {path}: {source}")]
    CreateDataDirectory {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error("database state lock is poisoned")]
    LockPoisoned,
}

pub struct DatabaseState {
    database_path: PathBuf,
    database: Mutex<Database>,
}

impl DatabaseState {
    pub fn initialize(data_directory: impl AsRef<Path>) -> Result<Self, DatabaseRuntimeError> {
        let data_directory = data_directory.as_ref();
        fs::create_dir_all(data_directory).map_err(|source| {
            DatabaseRuntimeError::CreateDataDirectory {
                path: data_directory.to_path_buf(),
                source,
            }
        })?;

        let database_path = data_directory.join(DATABASE_FILE_NAME);
        let database = Database::open(&database_path)?;

        Ok(Self {
            database_path,
            database: Mutex::new(database),
        })
    }

    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    pub fn lock(&self) -> Result<MutexGuard<'_, Database>, DatabaseRuntimeError> {
        self.database
            .lock()
            .map_err(|_| DatabaseRuntimeError::LockPoisoned)
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, sync::Arc, thread};

    use uuid::Uuid;

    use super::{DatabaseRuntimeError, DatabaseState, DATABASE_FILE_NAME};

    #[test]
    fn initialize_creates_nested_directory_and_database() {
        let root = temporary_root();
        let data_directory = root.join("nested").join("data");

        let state = DatabaseState::initialize(&data_directory).unwrap();

        assert_eq!(
            state.database_path(),
            data_directory.join(DATABASE_FILE_NAME)
        );
        assert!(state.database_path().is_file());
        assert_eq!(state.lock().unwrap().list_categories().unwrap().len(), 1);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reinitialize_reuses_persisted_database() {
        let root = temporary_root();
        let category_id = {
            let state = DatabaseState::initialize(&root).unwrap();
            let category = state.lock().unwrap().create_category("Persisted").unwrap();
            category.id()
        };

        let reopened = DatabaseState::initialize(&root).unwrap();
        let category = reopened
            .lock()
            .unwrap()
            .category(category_id)
            .unwrap()
            .unwrap();
        assert_eq!(category.name().as_str(), "Persisted");

        drop(reopened);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn initialize_rejects_a_file_as_the_data_directory() {
        let root = temporary_root();
        fs::create_dir_all(&root).unwrap();
        let file_path = root.join("not-a-directory");
        fs::write(&file_path, b"occupied").unwrap();

        let error = DatabaseState::initialize(&file_path).err().unwrap();

        assert!(matches!(
            error,
            DatabaseRuntimeError::CreateDataDirectory { path, .. } if path == file_path
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn poisoned_database_lock_returns_a_typed_error() {
        let root = temporary_root();
        let state = Arc::new(DatabaseState::initialize(&root).unwrap());
        let worker_state = Arc::clone(&state);

        let worker = thread::spawn(move || {
            let _guard = worker_state.lock().unwrap();
            panic!("poison database state for the test");
        });
        assert!(worker.join().is_err());
        assert!(matches!(
            state.lock(),
            Err(DatabaseRuntimeError::LockPoisoned)
        ));

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    fn temporary_root() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("smartspace-runtime-{}", Uuid::new_v4()))
    }
}
