use rusqlite::Connection;
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
    use rusqlite::{params, Connection};

    use super::Database;
    use crate::storage::StorageError;

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
}
