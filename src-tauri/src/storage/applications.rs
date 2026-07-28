use rusqlite::{params, Connection, TransactionBehavior};
use uuid::Uuid;

use super::{Database, StorageError};
use crate::domain::{
    ApplicationConfig, ApplicationDisplayName, ApplicationExecutablePath, ApplicationIconCacheKey,
    ApplicationId, ApplicationPosition,
};

impl Database {
    pub fn list_applications(&self) -> Result<Vec<ApplicationConfig>, StorageError> {
        list_applications(&self.connection)
    }

    pub fn create_application(
        &mut self,
        display_name: impl Into<String>,
        executable_path: impl Into<String>,
        icon_cache_key: Option<String>,
    ) -> Result<ApplicationConfig, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing = list_applications(&transaction)?;
        let position = i64::try_from(existing.len()).map_err(|_| {
            corrupt_application_store("application count exceeds supported position range")
        })?;
        let application =
            ApplicationConfig::new(display_name, executable_path, icon_cache_key, position)?;

        transaction.execute(
            "INSERT INTO applications
             (id, display_name, executable_path, icon_cache_key, position)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                application.id().as_uuid().to_string(),
                application.display_name().as_str(),
                application.executable_path().as_str(),
                application
                    .icon_cache_key()
                    .map(ApplicationIconCacheKey::as_str),
                application.position().get(),
            ],
        )?;
        transaction.commit()?;

        Ok(application)
    }

    pub fn delete_application(
        &mut self,
        id: ApplicationId,
    ) -> Result<Vec<ApplicationConfig>, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing = list_applications(&transaction)?;
        let application = existing
            .iter()
            .find(|application| application.id() == id)
            .ok_or(StorageError::ApplicationNotFound { id })?;

        transaction.execute(
            "DELETE FROM applications WHERE id = ?1",
            [id.as_uuid().to_string()],
        )?;
        transaction.execute(
            "UPDATE applications SET position = position - 1 WHERE position > ?1",
            [application.position().get()],
        )?;
        let applications = list_applications(&transaction)?;
        transaction.commit()?;

        Ok(applications)
    }
}

fn list_applications(connection: &Connection) -> Result<Vec<ApplicationConfig>, StorageError> {
    let mut statement = connection.prepare(
        "SELECT id, display_name, executable_path, icon_cache_key, position
         FROM applications
         ORDER BY position ASC, id ASC",
    )?;
    let records = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(map_application_read_error)?;

    let applications = records
        .into_iter()
        .map(application_from_record)
        .collect::<Result<Vec<_>, _>>()?;
    validate_application_store(&applications)?;
    Ok(applications)
}

fn application_from_record(
    (id, display_name, executable_path, icon_cache_key, position): (
        String,
        String,
        String,
        Option<String>,
        i64,
    ),
) -> Result<ApplicationConfig, StorageError> {
    let id =
        ApplicationId::from_uuid(Uuid::parse_str(&id).map_err(|_| {
            corrupt_application_store("application identifiers must be valid UUIDs")
        })?);

    let stored_display_name = display_name;
    let display_name = ApplicationDisplayName::new(stored_display_name.clone())
        .map_err(|_| corrupt_application_store("application display names must be valid"))?;
    if display_name.as_str() != stored_display_name {
        return Err(corrupt_application_store(
            "application display names must already be trimmed",
        ));
    }

    let executable_path = ApplicationExecutablePath::new(executable_path)
        .map_err(|_| corrupt_application_store("application executable paths must be valid"))?;

    let icon_cache_key = icon_cache_key
        .map(|stored_icon_cache_key| {
            let icon_cache_key = ApplicationIconCacheKey::new(stored_icon_cache_key.clone())
                .map_err(|_| {
                    corrupt_application_store("application icon cache keys must be valid")
                })?;
            if icon_cache_key.as_str() != stored_icon_cache_key {
                return Err(corrupt_application_store(
                    "application icon cache keys must already be trimmed",
                ));
            }
            Ok(icon_cache_key)
        })
        .transpose()?;

    let position = ApplicationPosition::new(position)
        .map_err(|_| corrupt_application_store("application positions must be non-negative"))?;

    ApplicationConfig::restore(id, display_name, executable_path, icon_cache_key, position)
        .map_err(StorageError::from)
}

fn validate_application_store(applications: &[ApplicationConfig]) -> Result<(), StorageError> {
    for (expected_position, application) in applications.iter().enumerate() {
        let expected_position = i64::try_from(expected_position).map_err(|_| {
            corrupt_application_store("application count exceeds supported position range")
        })?;
        if application.position().get() != expected_position {
            return Err(corrupt_application_store(
                "application positions must be the contiguous range 0..n-1",
            ));
        }
    }
    Ok(())
}

fn corrupt_application_store(reason: &'static str) -> StorageError {
    StorageError::CorruptApplicationStore { reason }
}

fn map_application_read_error(error: rusqlite::Error) -> StorageError {
    if matches!(
        error,
        rusqlite::Error::InvalidColumnType(..) | rusqlite::Error::IntegralValueOutOfRange(..)
    ) {
        corrupt_application_store("application columns must use their declared storage types")
    } else {
        StorageError::Sqlite(error)
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        sync::{Arc, Barrier},
        thread,
    };

    use rusqlite::{params, Connection};
    use uuid::Uuid;

    use super::Database;
    use crate::{domain::DomainError, storage::StorageError};

    #[test]
    fn empty_application_store_returns_an_empty_list() {
        let database = Database::open_in_memory().unwrap();

        assert_eq!(database.list_applications().unwrap(), Vec::new());
    }

    #[test]
    fn applications_are_restored_in_position_order() {
        let database = Database::open_in_memory().unwrap();
        insert_application(
            &database.connection,
            "40000000-0000-0000-0000-000000000002",
            "Editor",
            r"C:\Tools\Editor.exe",
            None,
            1,
        );
        insert_application(
            &database.connection,
            "40000000-0000-0000-0000-000000000001",
            "Terminal",
            r"C:\Tools\Terminal.EXE",
            Some("terminal-icon"),
            0,
        );

        let applications = database.list_applications().unwrap();
        assert_eq!(applications.len(), 2);
        assert_eq!(
            applications
                .iter()
                .map(|application| application.id().as_uuid().to_string())
                .collect::<Vec<_>>(),
            vec![
                "40000000-0000-0000-0000-000000000001",
                "40000000-0000-0000-0000-000000000002",
            ]
        );
        assert_eq!(applications[0].display_name().as_str(), "Terminal");
        assert_eq!(
            applications[0].executable_path().as_str(),
            r"C:\Tools\Terminal.EXE"
        );
        assert_eq!(
            applications[0].icon_cache_key().unwrap().as_str(),
            "terminal-icon"
        );
        assert_eq!(applications[0].position().get(), 0);
        assert_eq!(applications[1].display_name().as_str(), "Editor");
        assert_eq!(applications[1].icon_cache_key(), None);
        assert_eq!(applications[1].position().get(), 1);
    }

    #[test]
    fn applications_are_normalized_appended_and_persisted() {
        let path = temporary_database_path();
        let (terminal, editor) = {
            let mut database = Database::open(&path).unwrap();
            let terminal = database
                .create_application(
                    "  Terminal  ",
                    r"C:\Tools\Terminal.EXE",
                    Some("  terminal-icon  ".to_owned()),
                )
                .unwrap();
            let editor = database
                .create_application("Editor", r"C:\Tools\Editor.exe", None)
                .unwrap();

            assert_eq!(terminal.display_name().as_str(), "Terminal");
            assert_eq!(
                terminal.executable_path().as_str(),
                r"C:\Tools\Terminal.EXE"
            );
            assert_eq!(terminal.icon_cache_key().unwrap().as_str(), "terminal-icon");
            assert_eq!(terminal.position().get(), 0);
            assert_eq!(editor.position().get(), 1);
            assert_ne!(terminal.id(), editor.id());
            (terminal, editor)
        };

        let database = Database::open(&path).unwrap();
        assert_eq!(
            database.list_applications().unwrap(),
            vec![terminal, editor]
        );
        drop(database);
        remove_database_files(&path);
    }

    #[test]
    fn invalid_application_input_does_not_write() {
        let mut database = Database::open_in_memory().unwrap();

        for (display_name, executable_path, icon_cache_key, expected) in [
            (
                "  ",
                r"C:\Tools\Blank.exe",
                None,
                DomainError::EmptyApplicationDisplayName,
            ),
            (
                "Relative",
                r"Tools\Relative.exe",
                None,
                DomainError::ApplicationExecutablePathNotAbsolute,
            ),
            (
                "Blank icon",
                r"C:\Tools\BlankIcon.exe",
                Some(" \t ".to_owned()),
                DomainError::EmptyApplicationIconCacheKey,
            ),
        ] {
            match database
                .create_application(display_name, executable_path, icon_cache_key)
                .unwrap_err()
            {
                StorageError::Domain(actual) => assert_eq!(actual, expected),
                other => panic!("expected domain validation error, got {other:?}"),
            }
            assert!(database.list_applications().unwrap().is_empty());
        }
    }

    #[test]
    fn corrupt_application_store_rejects_creation_without_writing() {
        let mut database = Database::open_in_memory().unwrap();
        insert_application(
            &database.connection,
            "40000000-0000-0000-0000-000000000001",
            "Existing",
            r"C:\Tools\Existing.exe",
            None,
            1,
        );
        let before = stored_application_rows(&database.connection);

        assert!(matches!(
            database.create_application("New", r"C:\Tools\New.exe", None),
            Err(StorageError::CorruptApplicationStore { .. })
        ));
        assert_eq!(stored_application_rows(&database.connection), before);
    }

    #[test]
    fn concurrent_creates_receive_distinct_contiguous_positions() {
        let path = temporary_database_path();
        drop(Database::open(&path).unwrap());
        let barrier = Arc::new(Barrier::new(2));
        let workers: Vec<_> = [("Terminal", "Terminal.exe"), ("Editor", "Editor.exe")]
            .into_iter()
            .map(|(display_name, executable_name)| {
                let path = path.clone();
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    let mut database = Database::open(path).unwrap();
                    barrier.wait();
                    database
                        .create_application(
                            display_name,
                            format!(r"C:\Tools\{executable_name}"),
                            None,
                        )
                        .unwrap()
                })
            })
            .collect();
        let mut created = workers
            .into_iter()
            .map(|worker| worker.join().unwrap())
            .collect::<Vec<_>>();
        created.sort_by_key(|application| application.position().get());

        assert_eq!(
            created
                .iter()
                .map(|application| application.position().get())
                .collect::<Vec<_>>(),
            vec![0, 1]
        );
        assert_ne!(created[0].id(), created[1].id());
        let database = Database::open(&path).unwrap();
        assert_eq!(database.list_applications().unwrap(), created);
        drop(database);
        remove_database_files(&path);
    }

    #[test]
    fn deleting_middle_head_and_tail_compacts_and_persists_positions() {
        let path = temporary_database_path();
        let (first, middle, last) = {
            let mut database = Database::open(&path).unwrap();
            (
                database
                    .create_application("First", r"C:\Tools\First.exe", None)
                    .unwrap(),
                database
                    .create_application("Middle", r"C:\Tools\Middle.exe", None)
                    .unwrap(),
                database
                    .create_application("Last", r"C:\Tools\Last.exe", None)
                    .unwrap(),
            )
        };

        let after_middle = {
            let mut database = Database::open(&path).unwrap();
            database.delete_application(middle.id()).unwrap()
        };
        assert_application_ids_and_positions(&after_middle, &[first.id(), last.id()]);
        assert_eq!(
            Database::open(&path).unwrap().list_applications().unwrap(),
            after_middle
        );

        let after_head = {
            let mut database = Database::open(&path).unwrap();
            database.delete_application(first.id()).unwrap()
        };
        assert_application_ids_and_positions(&after_head, &[last.id()]);
        assert_eq!(
            Database::open(&path).unwrap().list_applications().unwrap(),
            after_head
        );

        let after_tail = {
            let mut database = Database::open(&path).unwrap();
            database.delete_application(last.id()).unwrap()
        };
        assert!(after_tail.is_empty());
        assert!(Database::open(&path)
            .unwrap()
            .list_applications()
            .unwrap()
            .is_empty());
        remove_database_files(&path);
    }

    #[test]
    fn deleting_unknown_application_does_not_write() {
        let mut database = Database::open_in_memory().unwrap();
        let existing = database
            .create_application("Existing", r"C:\Tools\Existing.exe", None)
            .unwrap();
        let before = stored_application_rows(&database.connection);
        let missing_id = crate::domain::ApplicationId::new();

        assert!(matches!(
            database.delete_application(missing_id),
            Err(StorageError::ApplicationNotFound { id }) if id == missing_id
        ));
        assert_eq!(stored_application_rows(&database.connection), before);
        assert_eq!(database.list_applications().unwrap(), vec![existing]);
    }

    #[test]
    fn corrupt_application_store_rejects_deletion_without_writing() {
        let mut database = Database::open_in_memory().unwrap();
        insert_application(
            &database.connection,
            "40000000-0000-0000-0000-000000000001",
            "Existing",
            r"C:\Tools\Existing.exe",
            None,
            1,
        );
        let before = stored_application_rows(&database.connection);
        let id = crate::domain::ApplicationId::from_uuid(
            Uuid::parse_str("40000000-0000-0000-0000-000000000001").unwrap(),
        );

        assert!(matches!(
            database.delete_application(id),
            Err(StorageError::CorruptApplicationStore { .. })
        ));
        assert_eq!(stored_application_rows(&database.connection), before);
    }

    #[test]
    fn invalid_application_ids_are_not_hidden() {
        let database = Database::open_in_memory().unwrap();
        insert_application(
            &database.connection,
            "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            "Invalid ID",
            r"C:\Tools\Invalid.exe",
            None,
            0,
        );

        assert!(matches!(
            database.list_applications(),
            Err(StorageError::CorruptApplicationStore { .. })
        ));
    }

    #[test]
    fn invalid_application_column_types_are_reported_as_corrupt_storage() {
        let database = Database::open_in_memory().unwrap();
        database
            .connection
            .execute(
                "INSERT INTO applications
                 (id, display_name, executable_path, icon_cache_key, position)
                 VALUES (?1, x'4578616d706c65', ?2, NULL, 0)",
                [
                    "40000000-0000-0000-0000-000000000001",
                    r"C:\Tools\Example.exe",
                ],
            )
            .unwrap();

        assert!(matches!(
            database.list_applications(),
            Err(StorageError::CorruptApplicationStore { .. })
        ));
    }

    #[test]
    fn noncanonical_or_invalid_application_strings_are_rejected() {
        for (display_name, executable_path, icon_cache_key) in [
            ("  Example  ", r"C:\Tools\Example.exe", None),
            ("Example", "relative\\Example.exe", None),
            ("Example", "C:\\Tools\\bad\0name.exe", None),
            ("Example", r"C:\Tools\Example.exe", Some("  icon  ")),
        ] {
            let database = Database::open_in_memory().unwrap();
            insert_application(
                &database.connection,
                "40000000-0000-0000-0000-000000000001",
                display_name,
                executable_path,
                icon_cache_key,
                0,
            );

            assert!(matches!(
                database.list_applications(),
                Err(StorageError::CorruptApplicationStore { .. })
            ));
        }
    }

    #[test]
    fn duplicate_or_gapped_positions_are_rejected_without_rewriting_rows() {
        for positions in [[0, 0], [0, 2]] {
            let database = Database::open_in_memory().unwrap();
            insert_application(
                &database.connection,
                "40000000-0000-0000-0000-000000000001",
                "First",
                r"C:\Tools\First.exe",
                None,
                positions[0],
            );
            insert_application(
                &database.connection,
                "40000000-0000-0000-0000-000000000002",
                "Second",
                r"C:\Tools\Second.exe",
                None,
                positions[1],
            );
            let before = stored_application_rows(&database.connection);

            assert!(matches!(
                database.list_applications(),
                Err(StorageError::CorruptApplicationStore { .. })
            ));
            assert_eq!(stored_application_rows(&database.connection), before);
        }
    }

    fn insert_application(
        connection: &Connection,
        id: &str,
        display_name: &str,
        executable_path: &str,
        icon_cache_key: Option<&str>,
        position: i64,
    ) {
        connection
            .execute(
                "INSERT INTO applications
                 (id, display_name, executable_path, icon_cache_key, position)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, display_name, executable_path, icon_cache_key, position],
            )
            .unwrap();
    }

    type StoredApplicationRow = (String, String, String, Option<String>, i64);

    fn stored_application_rows(connection: &Connection) -> Vec<StoredApplicationRow> {
        let mut statement = connection
            .prepare(
                "SELECT id, display_name, executable_path, icon_cache_key, position
                 FROM applications ORDER BY rowid",
            )
            .unwrap();
        statement
            .query_map([], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            })
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap()
    }

    fn assert_application_ids_and_positions(
        applications: &[crate::domain::ApplicationConfig],
        expected_ids: &[crate::domain::ApplicationId],
    ) {
        assert_eq!(
            applications
                .iter()
                .map(crate::domain::ApplicationConfig::id)
                .collect::<Vec<_>>(),
            expected_ids
        );
        assert_eq!(
            applications
                .iter()
                .map(|application| application.position().get())
                .collect::<Vec<_>>(),
            (0..applications.len() as i64).collect::<Vec<_>>()
        );
    }

    fn temporary_database_path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("smartspace-applications-{}.sqlite", Uuid::new_v4()))
    }

    fn remove_database_files(path: &std::path::Path) {
        fs::remove_file(path).unwrap();
        let _ = fs::remove_file(path.with_extension("sqlite-wal"));
        let _ = fs::remove_file(path.with_extension("sqlite-shm"));
    }
}
