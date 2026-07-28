use std::{path::Path, time::Duration};

use rusqlite::{Connection, TransactionBehavior};
use thiserror::Error;

use crate::domain::{CategoryId, DomainError};

mod categories;
mod runtime;
mod tasks;

pub use categories::CategoryDeletionSnapshot;
pub use runtime::{DatabaseRuntimeError, DatabaseState, DATABASE_FILE_NAME};

pub const CURRENT_SCHEMA_VERSION: i64 = 2;

const SCHEMA_META_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS schema_meta (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    version INTEGER NOT NULL CHECK (version >= 0)
);
INSERT OR IGNORE INTO schema_meta (singleton, version) VALUES (1, 0);
"#;

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        sql: include_str!("migrations/0001_initial.sql"),
    },
    Migration {
        version: 2,
        sql: include_str!("migrations/0002_applications.sql"),
    },
];

#[derive(Debug, Error)]
pub enum StorageError {
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error("database schema version {found} is newer than supported version {supported}")]
    UnsupportedSchemaVersion { found: i64, supported: i64 },
    #[error("expected migration version {expected}, found {found}")]
    NonSequentialMigration { expected: i64, found: i64 },
    #[error("migration catalog ends at version {highest}, but supported version is {supported}")]
    MigrationCatalogMismatch { highest: i64, supported: i64 },
    #[error(transparent)]
    Domain(#[from] DomainError),
    #[error(transparent)]
    InvalidUuid(#[from] uuid::Error),
    #[error("unknown category kind: {0}")]
    InvalidCategoryKind(String),
    #[error("invalid RFC3339 timestamp in storage: {0}")]
    InvalidTimestamp(#[from] chrono::ParseError),
    #[error("category storage invariant violated: {reason}")]
    CorruptCategoryStore { reason: &'static str },
    #[error("category {id:?} was not found")]
    CategoryNotFound { id: CategoryId },
    #[error("a category with that name already exists")]
    DuplicateCategoryName,
    #[error("category order must contain every category exactly once")]
    InvalidCategoryOrder,
    #[error("unknown task status: {0}")]
    InvalidTaskStatus(String),
    #[error("invalid task due date: {0}")]
    InvalidTaskDate(String),
    #[error("task {id:?} was not found")]
    TaskNotFound { id: crate::domain::TaskId },
    #[error("task order must contain every task in the category exactly once")]
    InvalidTaskOrder,
    #[error("task storage invariant violated: {reason}")]
    CorruptTaskStore { reason: &'static str },
}

#[derive(Debug, Clone, Copy)]
struct Migration {
    version: i64,
    sql: &'static str,
}

pub struct Database {
    connection: Connection,
}

impl Database {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        Self::from_connection(Connection::open(path)?)
    }

    pub fn open_in_memory() -> Result<Self, StorageError> {
        Self::from_connection(Connection::open_in_memory()?)
    }

    pub fn schema_version(&self) -> Result<i64, StorageError> {
        Ok(read_schema_version(&self.connection)?)
    }

    fn from_connection(mut connection: Connection) -> Result<Self, StorageError> {
        configure_connection_defaults(&connection)?;
        let existing_version =
            supported_existing_schema_version(&connection, CURRENT_SCHEMA_VERSION)?;
        if existing_version.is_none() {
            initialize_schema_meta(&connection)?;
        }
        apply_migrations(&mut connection, MIGRATIONS, CURRENT_SCHEMA_VERSION)?;
        configure_journal_mode(&connection)?;
        Ok(Self { connection })
    }
}

fn configure_connection_defaults(connection: &Connection) -> rusqlite::Result<()> {
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.pragma_update(None, "foreign_keys", true)?;
    Ok(())
}

fn configure_journal_mode(connection: &Connection) -> rusqlite::Result<()> {
    connection.pragma_update(None, "journal_mode", "WAL")?;
    Ok(())
}

fn initialize_schema_meta(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(SCHEMA_META_SQL)
}

fn read_schema_version(connection: &Connection) -> rusqlite::Result<i64> {
    connection.query_row(
        "SELECT version FROM schema_meta WHERE singleton = 1",
        [],
        |row| row.get(0),
    )
}

fn existing_schema_version(connection: &Connection) -> rusqlite::Result<Option<i64>> {
    let has_schema_meta = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'schema_meta')",
        [],
        |row| row.get::<_, bool>(0),
    )?;

    if has_schema_meta {
        read_schema_version(connection).map(Some)
    } else {
        Ok(None)
    }
}

fn supported_existing_schema_version(
    connection: &Connection,
    supported_version: i64,
) -> Result<Option<i64>, StorageError> {
    let existing_version = existing_schema_version(connection)?;
    if let Some(found) = existing_version {
        if found > supported_version {
            return Err(StorageError::UnsupportedSchemaVersion {
                found,
                supported: supported_version,
            });
        }
    }

    Ok(existing_version)
}

fn validate_migration_catalog(
    migrations: &[Migration],
    supported_version: i64,
) -> Result<(), StorageError> {
    for (index, migration) in migrations.iter().enumerate() {
        let expected = index as i64 + 1;
        if migration.version != expected {
            return Err(StorageError::NonSequentialMigration {
                expected,
                found: migration.version,
            });
        }
    }

    let highest = migrations.last().map_or(0, |migration| migration.version);
    if highest != supported_version {
        return Err(StorageError::MigrationCatalogMismatch {
            highest,
            supported: supported_version,
        });
    }

    Ok(())
}

fn apply_migrations(
    connection: &mut Connection,
    migrations: &[Migration],
    supported_version: i64,
) -> Result<(), StorageError> {
    validate_migration_catalog(migrations, supported_version)?;
    let mut current = read_schema_version(connection)?;

    for migration in migrations {
        if migration.version <= current {
            continue;
        }

        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        current = read_schema_version(&transaction)?;

        if current > supported_version {
            return Err(StorageError::UnsupportedSchemaVersion {
                found: current,
                supported: supported_version,
            });
        }
        if migration.version <= current {
            transaction.commit()?;
            continue;
        }

        transaction.execute_batch(migration.sql)?;
        transaction.execute(
            "UPDATE schema_meta SET version = ?1 WHERE singleton = 1",
            [migration.version],
        )?;
        transaction.commit()?;
        current = migration.version;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        sync::{Arc, Barrier},
        thread,
    };

    use rusqlite::{params, Connection, ErrorCode, TransactionBehavior};
    use uuid::Uuid;

    use super::{
        apply_migrations, configure_connection_defaults, initialize_schema_meta,
        read_schema_version, Database, Migration, StorageError, CURRENT_SCHEMA_VERSION, MIGRATIONS,
    };
    use crate::domain::CategoryId;

    const OTHER_CATEGORY_ID: &str = "10000000-0000-0000-0000-000000000001";

    #[test]
    fn file_database_uses_wal_journal_mode() {
        let path = temporary_database_path();
        {
            let database = Database::open(&path).unwrap();
            let journal_mode = database
                .connection
                .query_row("PRAGMA journal_mode", [], |row| row.get::<_, String>(0))
                .unwrap();
            assert_eq!(journal_mode, "wal");
        }

        remove_database_files(&path);
    }

    #[test]
    fn concurrent_database_opens_do_not_repeat_migrations() {
        const WORKER_COUNT: usize = 4;

        let path = temporary_database_path();
        let barrier = Arc::new(Barrier::new(WORKER_COUNT + 1));
        let workers: Vec<_> = (0..WORKER_COUNT)
            .map(|_| {
                let path = path.clone();
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    barrier.wait();
                    Database::open(path).map(|database| database.schema_version().unwrap())
                })
            })
            .collect();

        barrier.wait();
        for worker in workers {
            assert_eq!(worker.join().unwrap().unwrap(), CURRENT_SCHEMA_VERSION);
        }

        let database = Database::open(&path).unwrap();
        assert_eq!(
            database
                .connection
                .query_row("SELECT COUNT(*) FROM categories", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            1
        );
        drop(database);
        remove_database_files(&path);
    }

    #[test]
    fn migrated_database_reopens_while_another_writer_is_active() {
        let path = temporary_database_path();
        drop(Database::open(&path).unwrap());

        let mut writer = Connection::open(&path).unwrap();
        let transaction = writer
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .unwrap();

        let reopened = Database::open(&path).unwrap();
        assert_eq!(reopened.schema_version().unwrap(), CURRENT_SCHEMA_VERSION);

        drop(reopened);
        transaction.rollback().unwrap();
        drop(writer);
        remove_database_files(&path);
    }

    #[test]
    fn fresh_database_creates_schema_and_exactly_one_inbox() {
        let database = Database::open_in_memory().unwrap();

        assert_eq!(database.schema_version().unwrap(), CURRENT_SCHEMA_VERSION);
        assert_eq!(
            database
                .connection
                .query_row("PRAGMA foreign_keys", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            database
                .connection
                .query_row(
                    "SELECT COUNT(*) FROM categories WHERE id = ?1 AND kind = 'inbox'",
                    [CategoryId::INBOX.as_uuid().to_string()],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap(),
            1
        );
        assert_eq!(
            database
                .connection
                .query_row("SELECT COUNT(*) FROM applications", [], |row| {
                    row.get::<_, i64>(0)
                })
                .unwrap(),
            0
        );
    }

    #[test]
    fn version_one_database_migrates_without_changing_tasks_or_categories() {
        let path = temporary_database_path();
        let (categories_before, tasks_before) = {
            let mut connection = Connection::open(&path).unwrap();
            configure_connection_defaults(&connection).unwrap();
            initialize_schema_meta(&connection).unwrap();
            apply_migrations(&mut connection, &MIGRATIONS[..1], 1).unwrap();
            connection
                .execute(
                    "INSERT INTO categories (id, name, position, kind) VALUES (?1, 'Work', 1, 'user')",
                    [OTHER_CATEGORY_ID],
                )
                .unwrap();
            connection
                .execute(
                    "INSERT INTO tasks (id, title, status, category_id, position, created_at, updated_at)
                     VALUES ('30000000-0000-0000-0000-000000000005', 'Preserved task', 'open', ?1, 0, ?2, ?2)",
                    params![OTHER_CATEGORY_ID, "2026-07-28T12:00:00.000000000Z"],
                )
                .unwrap();
            (
                stored_category_rows(&connection),
                stored_task_rows(&connection),
            )
        };

        let database = Database::open(&path).unwrap();
        assert_eq!(database.schema_version().unwrap(), CURRENT_SCHEMA_VERSION);
        assert_eq!(
            stored_category_rows(&database.connection),
            categories_before
        );
        assert_eq!(stored_task_rows(&database.connection), tasks_before);
        assert_eq!(
            database
                .connection
                .query_row("SELECT COUNT(*) FROM applications", [], |row| {
                    row.get::<_, i64>(0)
                })
                .unwrap(),
            0
        );

        drop(database);
        remove_database_files(&path);
    }

    #[test]
    fn application_schema_rejects_invalid_configuration_fields() {
        let database = Database::open_in_memory().unwrap();
        let connection = &database.connection;

        connection
            .execute(
                "INSERT INTO applications (id, display_name, executable_path, icon_cache_key, position)
                 VALUES ('40000000-0000-0000-0000-000000000001', 'Example', 'C:\\Example\\example.exe', NULL, 0)",
                [],
            )
            .unwrap();
        assert_constraint_violation(connection.execute(
            "INSERT INTO applications (id, display_name, executable_path, position)
             VALUES ('40000000-0000-0000-0000-000000000002', char(9), 'C:\\Example\\blank-name.exe', 1)",
            [],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO applications (id, display_name, executable_path, position)
             VALUES ('40000000-0000-0000-0000-000000000003', 'Blank path', char(10), 1)",
            [],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO applications (id, display_name, executable_path, icon_cache_key, position)
             VALUES ('40000000-0000-0000-0000-000000000004', 'Blank icon', 'C:\\Example\\blank-icon.exe', ' ', 1)",
            [],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO applications (id, display_name, executable_path, position)
             VALUES ('40000000-0000-0000-0000-000000000005', 'Negative position', 'C:\\Example\\negative.exe', -1)",
            [],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO applications (id, display_name, executable_path, position)
             VALUES ('40000000-0000-0000-0000-000000000006', 'Text position', 'C:\\Example\\text.exe', 'abc')",
            [],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO applications (id, display_name, executable_path, position)
             VALUES ('40000000-0000-0000-0000-000000000007', 'Fractional position', 'C:\\Example\\fractional.exe', 0.5)",
            [],
        ));
    }

    #[test]
    fn migrations_are_idempotent() {
        let mut database = Database::open_in_memory().unwrap();

        apply_migrations(&mut database.connection, MIGRATIONS, CURRENT_SCHEMA_VERSION).unwrap();

        assert_eq!(database.schema_version().unwrap(), CURRENT_SCHEMA_VERSION);
        assert_eq!(
            database
                .connection
                .query_row("SELECT COUNT(*) FROM categories", [], |row| {
                    row.get::<_, i64>(0)
                })
                .unwrap(),
            1
        );
    }

    #[test]
    fn schema_constraints_reject_invalid_rows() {
        let database = Database::open_in_memory().unwrap();
        let connection = &database.connection;

        assert_constraint_violation(connection.execute(
            "INSERT INTO categories (id, name, position, kind) VALUES (?1, char(9) || char(10), 1, 'user')",
            [OTHER_CATEGORY_ID],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO categories (id, name, position, kind) VALUES (?1, 'Work', 1, 'other')",
            [OTHER_CATEGORY_ID],
        ));

        connection
            .execute(
                "INSERT INTO categories (id, name, position, kind) VALUES (?1, 'Work', 1, 'user')",
                [OTHER_CATEGORY_ID],
            )
            .unwrap();
        assert_constraint_violation(connection.execute(
            "INSERT INTO categories (id, name, position, kind) VALUES ('20000000-0000-0000-0000-000000000001', 'work', 2, 'user')",
            [],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO tasks (id, title, status, category_id, position, created_at, updated_at)
             VALUES ('30000000-0000-0000-0000-000000000001', 'Task', 'invalid', ?1, 0, ?2, ?2)",
            params![OTHER_CATEGORY_ID, "2026-07-27T12:00:00Z"],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO tasks (id, title, status, category_id, position, created_at, updated_at)
             VALUES ('30000000-0000-0000-0000-000000000004', char(9), 'open', ?1, 0, ?2, ?2)",
            params![OTHER_CATEGORY_ID, "2026-07-27T12:00:00Z"],
        ));
        assert_constraint_violation(connection.execute(
            "INSERT INTO tasks (id, title, status, category_id, position, created_at, updated_at)
             VALUES ('30000000-0000-0000-0000-000000000002', 'Task', 'open', ?1, 0, ?2, ?3)",
            params![
                OTHER_CATEGORY_ID,
                "2026-07-27T12:00:00Z",
                "2026-07-27T11:59:59Z"
            ],
        ));
    }

    #[test]
    fn foreign_keys_reject_tasks_with_missing_categories() {
        let database = Database::open_in_memory().unwrap();
        let result = database.connection.execute(
            "INSERT INTO tasks (id, title, status, category_id, position, created_at, updated_at)
             VALUES ('30000000-0000-0000-0000-000000000003', 'Task', 'open', ?1, 0, ?2, ?2)",
            params![OTHER_CATEGORY_ID, "2026-07-27T12:00:00Z"],
        );

        assert_constraint_violation(result);
    }

    #[test]
    fn failed_migration_rolls_back_schema_and_version() {
        let mut database = Database::open_in_memory().unwrap();
        let failing = [
            Migration {
                version: 1,
                sql: "",
            },
            Migration {
                version: 2,
                sql: "",
            },
            Migration {
                version: 3,
                sql: "CREATE TABLE half_done (id INTEGER PRIMARY KEY); INSERT INTO missing_table VALUES (1);",
            },
        ];

        assert!(apply_migrations(&mut database.connection, &failing, 3).is_err());
        assert_eq!(database.schema_version().unwrap(), CURRENT_SCHEMA_VERSION);
        assert_eq!(
            database
                .connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'half_done'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn future_schema_versions_are_rejected() {
        let connection = Connection::open_in_memory().unwrap();
        initialize_schema_meta(&connection).unwrap();
        connection
            .execute(
                "UPDATE schema_meta SET version = ?1 WHERE singleton = 1",
                [CURRENT_SCHEMA_VERSION + 1],
            )
            .unwrap();

        assert!(matches!(
            Database::from_connection(connection),
            Err(StorageError::UnsupportedSchemaVersion { .. })
        ));
    }

    #[test]
    fn rejecting_a_future_file_database_does_not_change_its_journal_mode() {
        let path = temporary_database_path();
        {
            let connection = Connection::open(&path).unwrap();
            initialize_schema_meta(&connection).unwrap();
            connection
                .execute(
                    "UPDATE schema_meta SET version = ?1 WHERE singleton = 1",
                    [CURRENT_SCHEMA_VERSION + 1],
                )
                .unwrap();
            connection
                .pragma_update(None, "journal_mode", "DELETE")
                .unwrap();
        }

        assert!(matches!(
            Database::open(&path),
            Err(StorageError::UnsupportedSchemaVersion { .. })
        ));

        let connection = Connection::open(&path).unwrap();
        assert_eq!(
            connection
                .query_row("PRAGMA journal_mode", [], |row| row.get::<_, String>(0))
                .unwrap(),
            "delete"
        );
        assert_eq!(
            read_schema_version(&connection).unwrap(),
            CURRENT_SCHEMA_VERSION + 1
        );
        drop(connection);
        assert!(!path.with_extension("sqlite-wal").exists());
        assert!(!path.with_extension("sqlite-shm").exists());
        remove_database_files(&path);
    }

    #[test]
    fn migration_catalog_must_match_supported_version() {
        let mut database = Database::open_in_memory().unwrap();

        assert!(matches!(
            apply_migrations(&mut database.connection, MIGRATIONS, 3),
            Err(StorageError::MigrationCatalogMismatch {
                highest: CURRENT_SCHEMA_VERSION,
                supported: 3
            })
        ));
    }

    fn assert_constraint_violation(result: rusqlite::Result<usize>) {
        let error = result.unwrap_err();
        assert_eq!(
            error.sqlite_error_code(),
            Some(ErrorCode::ConstraintViolation)
        );
    }

    type StoredCategoryRow = (String, String, i64, String);
    type StoredTaskRow = (
        String,
        String,
        String,
        Option<String>,
        String,
        i64,
        String,
        String,
    );

    fn stored_category_rows(connection: &Connection) -> Vec<StoredCategoryRow> {
        let mut statement = connection
            .prepare("SELECT id, name, position, kind FROM categories ORDER BY position")
            .unwrap();
        statement
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap()
    }

    fn stored_task_rows(connection: &Connection) -> Vec<StoredTaskRow> {
        let mut statement = connection
            .prepare(
                "SELECT id, title, status, due_date, category_id, position, created_at, updated_at
                 FROM tasks ORDER BY category_id, position",
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
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                ))
            })
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap()
    }

    fn temporary_database_path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("smartspace-{}.sqlite", Uuid::new_v4()))
    }

    fn remove_database_files(path: &std::path::Path) {
        fs::remove_file(path).unwrap();
        let _ = fs::remove_file(path.with_extension("sqlite-wal"));
        let _ = fs::remove_file(path.with_extension("sqlite-shm"));
    }
}
