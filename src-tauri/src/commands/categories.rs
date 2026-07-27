use tauri::State;

use super::CommandError;
use crate::{
    domain::Category,
    storage::{DatabaseRuntimeError, DatabaseState},
};

#[tauri::command]
pub(crate) fn list_categories(
    database_state: State<'_, DatabaseState>,
) -> Result<Vec<Category>, CommandError> {
    list_categories_from_state(database_state.inner())
}

fn list_categories_from_state(
    database_state: &DatabaseState,
) -> Result<Vec<Category>, CommandError> {
    let database = database_state.lock().map_err(CommandError::from)?;
    database
        .list_categories()
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

#[cfg(test)]
mod tests {
    use std::{fs, sync::Arc, thread};

    use rusqlite::Connection;
    use uuid::Uuid;

    use super::list_categories_from_state;
    use crate::{
        commands::CommandErrorCode,
        domain::CategoryId,
        storage::{DatabaseState, DATABASE_FILE_NAME},
    };

    #[test]
    fn list_categories_returns_persisted_domain_objects_in_order() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        state.lock().unwrap().create_category("Work").unwrap();

        let categories = list_categories_from_state(&state).unwrap();

        assert_eq!(categories.len(), 2);
        assert_eq!(categories[0].id(), CategoryId::INBOX);
        assert_eq!(categories[1].name().as_str(), "Work");
        assert_eq!(categories[1].position(), 1);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_categories_maps_corrupt_storage_to_a_stable_error_code() {
        let root = temporary_root();
        drop(DatabaseState::initialize(&root).unwrap());
        let connection = Connection::open(root.join(DATABASE_FILE_NAME)).unwrap();
        connection
            .execute(
                "DELETE FROM categories WHERE id = ?1",
                [CategoryId::INBOX.as_uuid().to_string()],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = list_categories_from_state(&state).unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);
        let serialized = serde_json::to_value(&error).unwrap();
        assert_eq!(serialized["code"], "data_corrupt");
        assert!(serialized["message"].is_string());

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_categories_treats_invalid_persisted_ids_as_corrupt_data() {
        let root = temporary_root();
        drop(DatabaseState::initialize(&root).unwrap());
        let connection = Connection::open(root.join(DATABASE_FILE_NAME)).unwrap();
        connection
            .execute(
                "INSERT INTO categories (id, name, position, kind)
                 VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'Broken', 1, 'user')",
                [],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = list_categories_from_state(&state).unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_categories_maps_a_poisoned_lock_to_database_unavailable() {
        let root = temporary_root();
        let state = Arc::new(DatabaseState::initialize(&root).unwrap());
        let worker_state = Arc::clone(&state);
        let worker = thread::spawn(move || {
            let _guard = worker_state.lock().unwrap();
            panic!("poison database state for the command test");
        });
        assert!(worker.join().is_err());

        let error = list_categories_from_state(&state).unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DatabaseUnavailable);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    fn temporary_root() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("smartspace-command-{}", Uuid::new_v4()))
    }
}
