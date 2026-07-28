use std::collections::HashSet;

use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{ffi, params, Connection, TransactionBehavior};
use unicase::UniCase;
use uuid::Uuid;

use super::{Database, StorageError};
use crate::domain::{Category, CategoryId, CategoryKind, CategoryName, Task};

#[derive(Debug, PartialEq, Eq)]
pub struct CategoryDeletionSnapshot {
    pub migrated_task_count: usize,
    pub categories: Vec<Category>,
    pub tasks: Vec<Task>,
}

impl Database {
    pub fn list_categories(&self) -> Result<Vec<Category>, StorageError> {
        list_categories(&self.connection)
    }

    pub fn category(&self, id: CategoryId) -> Result<Option<Category>, StorageError> {
        Ok(self
            .list_categories()?
            .into_iter()
            .find(|category| category.id() == id))
    }

    pub fn create_category(&mut self, name: impl Into<String>) -> Result<Category, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing = list_categories(&transaction)?;
        let position =
            i64::try_from(existing.len()).map_err(|_| StorageError::CorruptCategoryStore {
                reason: "category count exceeds supported position range",
            })?;
        let category = Category::new_user(name, position)?;
        ensure_unique_category_name(&existing, &category, None)?;

        transaction
            .execute(
                "INSERT INTO categories (id, name, position, kind) VALUES (?1, ?2, ?3, 'user')",
                params![
                    category.id().as_uuid().to_string(),
                    category.name().as_str(),
                    category.position()
                ],
            )
            .map_err(map_category_write_error)?;
        transaction.commit()?;

        Ok(category)
    }

    pub fn rename_category(
        &mut self,
        id: CategoryId,
        name: impl Into<String>,
    ) -> Result<Category, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing = list_categories(&transaction)?;
        let mut category = existing
            .iter()
            .find(|category| category.id() == id)
            .cloned()
            .ok_or(StorageError::CategoryNotFound { id })?;
        category.rename(name)?;
        ensure_unique_category_name(&existing, &category, Some(id))?;

        transaction
            .execute(
                "UPDATE categories SET name = ?1 WHERE id = ?2",
                params![category.name().as_str(), id.as_uuid().to_string()],
            )
            .map_err(map_category_write_error)?;
        transaction.commit()?;

        Ok(category)
    }

    pub fn reorder_categories(
        &mut self,
        ordered_ids: &[CategoryId],
    ) -> Result<Vec<Category>, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing = list_categories(&transaction)?;
        let existing_ids: HashSet<_> = existing.iter().map(Category::id).collect();
        let ordered_set: HashSet<_> = ordered_ids.iter().copied().collect();

        if ordered_ids.len() != existing.len()
            || ordered_set.len() != ordered_ids.len()
            || ordered_set != existing_ids
        {
            return Err(StorageError::InvalidCategoryOrder);
        }

        for (position, id) in ordered_ids.iter().enumerate() {
            transaction.execute(
                "UPDATE categories SET position = ?1 WHERE id = ?2",
                params![position as i64, id.as_uuid().to_string()],
            )?;
        }

        let categories = list_categories(&transaction)?;
        transaction.commit()?;
        Ok(categories)
    }

    pub fn delete_category(
        &mut self,
        id: CategoryId,
        now: DateTime<Utc>,
    ) -> Result<CategoryDeletionSnapshot, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let categories = list_categories(&transaction)?;
        let category = categories
            .iter()
            .find(|category| category.id() == id)
            .cloned()
            .ok_or(StorageError::CategoryNotFound { id })?;
        category.ensure_deletable()?;

        let all_tasks = super::tasks::list_tasks_with_categories(&transaction, &categories)?;
        let tasks_to_migrate = all_tasks
            .into_iter()
            .filter(|task| task.category_id() == id)
            .collect::<Vec<_>>();
        let next_inbox_position: i64 = transaction.query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM tasks WHERE category_id = ?1",
            [CategoryId::INBOX.as_uuid().to_string()],
            |row| row.get(0),
        )?;

        for (offset, task) in tasks_to_migrate.iter().enumerate() {
            let updated_at = task
                .updated_at()
                .max(now)
                .to_rfc3339_opts(SecondsFormat::Nanos, true);
            transaction.execute(
                "UPDATE tasks
                 SET category_id = ?1,
                     position = ?2,
                     updated_at = ?3
                 WHERE id = ?4",
                params![
                    CategoryId::INBOX.as_uuid().to_string(),
                    next_inbox_position + offset as i64,
                    updated_at,
                    task.id().as_uuid().to_string()
                ],
            )?;
        }

        transaction.execute(
            "DELETE FROM categories WHERE id = ?1",
            [id.as_uuid().to_string()],
        )?;
        transaction.execute(
            "UPDATE categories SET position = position - 1 WHERE position > ?1",
            [category.position()],
        )?;
        let categories = list_categories(&transaction)?;
        let tasks = super::tasks::list_tasks_with_categories(&transaction, &categories)?;
        transaction.commit()?;

        Ok(CategoryDeletionSnapshot {
            migrated_task_count: tasks_to_migrate.len(),
            categories,
            tasks,
        })
    }
}

pub(super) fn list_categories(connection: &Connection) -> Result<Vec<Category>, StorageError> {
    let mut statement = connection
        .prepare("SELECT id, name, position, kind FROM categories ORDER BY position ASC, id ASC")?;
    let records = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let categories = records
        .into_iter()
        .map(category_from_record)
        .collect::<Result<Vec<_>, _>>()?;
    validate_category_store(&categories)?;
    Ok(categories)
}

fn category_from_record(
    (id, name, position, kind): (String, String, i64, String),
) -> Result<Category, StorageError> {
    let id = CategoryId::from_uuid(Uuid::parse_str(&id)?);
    let stored_name = name;
    let name = CategoryName::new(stored_name.clone())?;
    if name.as_str() != stored_name {
        return Err(StorageError::CorruptCategoryStore {
            reason: "category names must already be trimmed",
        });
    }
    let kind = match kind.as_str() {
        "inbox" => CategoryKind::Inbox,
        "user" => CategoryKind::User,
        _ => return Err(StorageError::InvalidCategoryKind(kind)),
    };
    Ok(Category::restore(id, name, position, kind)?)
}

fn map_category_write_error(error: rusqlite::Error) -> StorageError {
    if matches!(
        &error,
        rusqlite::Error::SqliteFailure(sqlite_error, _)
            if sqlite_error.extended_code == ffi::SQLITE_CONSTRAINT_UNIQUE
    ) {
        StorageError::DuplicateCategoryName
    } else {
        StorageError::Sqlite(error)
    }
}

fn ensure_unique_category_name(
    categories: &[Category],
    candidate: &Category,
    excluded_id: Option<CategoryId>,
) -> Result<(), StorageError> {
    let candidate_name = UniCase::new(candidate.name().as_str().to_owned());
    if categories.iter().any(|category| {
        Some(category.id()) != excluded_id
            && UniCase::new(category.name().as_str().to_owned()) == candidate_name
    }) {
        return Err(StorageError::DuplicateCategoryName);
    }
    Ok(())
}

fn validate_category_store(categories: &[Category]) -> Result<(), StorageError> {
    let inbox_count = categories
        .iter()
        .filter(|category| category.id() == CategoryId::INBOX)
        .count();
    if inbox_count != 1 {
        return Err(StorageError::CorruptCategoryStore {
            reason: "the fixed inbox category must exist exactly once",
        });
    }

    if categories
        .iter()
        .enumerate()
        .any(|(position, category)| category.position() != position as i64)
    {
        return Err(StorageError::CorruptCategoryStore {
            reason: "category positions must be the contiguous range 0..n-1",
        });
    }

    let mut names = HashSet::with_capacity(categories.len());
    if categories
        .iter()
        .any(|category| !names.insert(UniCase::new(category.name().as_str().to_owned())))
    {
        return Err(StorageError::CorruptCategoryStore {
            reason: "category names must be Unicode-caseless unique",
        });
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

    use chrono::{Duration, TimeZone, Utc};
    use rusqlite::params;
    use uuid::Uuid;

    use super::Database;
    use crate::{
        domain::{CategoryId, DomainError},
        storage::StorageError,
    };

    #[test]
    fn categories_can_be_created_listed_and_read() {
        let mut database = Database::open_in_memory().unwrap();

        let work = database.create_category("  Work  ").unwrap();
        let personal = database.create_category("Personal").unwrap();
        let categories = database.list_categories().unwrap();

        assert_eq!(work.name().as_str(), "Work");
        assert_eq!(work.position(), 1);
        assert_eq!(personal.position(), 2);
        assert_eq!(
            categories,
            vec![crate::domain::Category::inbox(), work.clone(), personal]
        );
        assert_eq!(database.category(work.id()).unwrap(), Some(work));
        assert_eq!(database.category(CategoryId::new()).unwrap(), None);
    }

    #[test]
    fn duplicate_names_are_reported_case_insensitively() {
        let mut database = Database::open_in_memory().unwrap();
        database.create_category("Work").unwrap();

        assert!(matches!(
            database.create_category("work"),
            Err(StorageError::DuplicateCategoryName)
        ));
        assert_eq!(database.list_categories().unwrap().len(), 2);
    }

    #[test]
    fn duplicate_names_are_reported_with_unicode_case_folding() {
        let mut database = Database::open_in_memory().unwrap();
        database.create_category("École").unwrap();

        assert!(matches!(
            database.create_category("éCOLE"),
            Err(StorageError::DuplicateCategoryName)
        ));
    }

    #[test]
    fn concurrent_writers_preserve_unicode_name_and_position_invariants() {
        let path = temporary_database_path();
        drop(Database::open(&path).unwrap());
        let barrier = Arc::new(Barrier::new(2));
        let workers: Vec<_> = ["École", "éCOLE"]
            .into_iter()
            .map(|name| {
                let path = path.clone();
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    let mut database = Database::open(path).unwrap();
                    barrier.wait();
                    database.create_category(name)
                })
            })
            .collect();

        let results: Vec<_> = workers
            .into_iter()
            .map(|worker| worker.join().unwrap())
            .collect();
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, Err(StorageError::DuplicateCategoryName)))
                .count(),
            1
        );

        let database = Database::open(&path).unwrap();
        assert_eq!(database.list_categories().unwrap().len(), 2);
        drop(database);
        remove_database_files(&path);
    }

    #[test]
    fn rename_and_reorder_persist_after_reopening() {
        let path = temporary_database_path();
        let (work_id, personal_id) = {
            let mut database = Database::open(&path).unwrap();
            let work = database.create_category("Work").unwrap();
            let personal = database.create_category("Personal").unwrap();

            let inbox = database
                .rename_category(CategoryId::INBOX, "Unsorted")
                .unwrap();
            assert_eq!(inbox.name().as_str(), "Unsorted");
            assert!(matches!(
                database.rename_category(personal.id(), "WORK"),
                Err(StorageError::DuplicateCategoryName)
            ));

            database
                .reorder_categories(&[personal.id(), CategoryId::INBOX, work.id()])
                .unwrap();
            (work.id(), personal.id())
        };

        let database = Database::open(&path).unwrap();
        let categories = database.list_categories().unwrap();
        assert_eq!(
            categories
                .iter()
                .map(|category| category.id())
                .collect::<Vec<_>>(),
            vec![personal_id, CategoryId::INBOX, work_id]
        );
        assert_eq!(
            categories
                .iter()
                .map(|category| category.position())
                .collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
        assert_eq!(
            database
                .category(CategoryId::INBOX)
                .unwrap()
                .unwrap()
                .name()
                .as_str(),
            "Unsorted"
        );
        drop(database);
        remove_database_files(&path);
    }

    #[test]
    fn invalid_reorder_is_rejected_without_partial_changes() {
        let mut database = Database::open_in_memory().unwrap();
        let work = database.create_category("Work").unwrap();
        let before = database.list_categories().unwrap();

        assert!(matches!(
            database.reorder_categories(&[work.id(), work.id()]),
            Err(StorageError::InvalidCategoryOrder)
        ));
        assert_eq!(database.list_categories().unwrap(), before);
    }

    #[test]
    fn deleting_a_category_moves_tasks_to_the_end_of_inbox_and_compacts_categories() {
        let mut database = Database::open_in_memory().unwrap();
        let work = database.create_category("Work").unwrap();
        let personal = database.create_category("Personal").unwrap();
        let inbox_id = CategoryId::INBOX.as_uuid().to_string();
        let work_id = work.id().as_uuid().to_string();

        insert_task(
            &database.connection,
            "10000000-0000-0000-0000-000000000001",
            &inbox_id,
            0,
            "2026-07-27T10:00:00.000000Z",
        );
        insert_task(
            &database.connection,
            "10000000-0000-0000-0000-000000000002",
            &work_id,
            1,
            "2026-07-27T12:00:00Z",
        );
        insert_task(
            &database.connection,
            "10000000-0000-0000-0000-000000000003",
            &work_id,
            0,
            "2026-07-27T13:00:00.000000Z",
        );

        let now =
            Utc.with_ymd_and_hms(2026, 7, 27, 12, 0, 0).unwrap() + Duration::milliseconds(500);
        let snapshot = database.delete_category(work.id(), now).unwrap();
        assert_eq!(snapshot.migrated_task_count, 2);
        assert_eq!(snapshot.categories.len(), 2);
        assert_eq!(snapshot.tasks.len(), 3);

        assert_eq!(database.category(work.id()).unwrap(), None);
        assert_eq!(
            database
                .category(personal.id())
                .unwrap()
                .unwrap()
                .position(),
            1
        );
        let moved = database
            .connection
            .prepare(
                "SELECT id, category_id, position, updated_at FROM tasks
                 WHERE id IN (?1, ?2) ORDER BY position ASC",
            )
            .unwrap()
            .query_map(
                params![
                    "10000000-0000-0000-0000-000000000002",
                    "10000000-0000-0000-0000-000000000003"
                ],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                },
            )
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap();

        assert_eq!(
            moved,
            vec![
                (
                    "10000000-0000-0000-0000-000000000003".to_owned(),
                    inbox_id.clone(),
                    1,
                    "2026-07-27T13:00:00.000000000Z".to_owned(),
                ),
                (
                    "10000000-0000-0000-0000-000000000002".to_owned(),
                    inbox_id,
                    2,
                    "2026-07-27T12:00:00.500000000Z".to_owned(),
                ),
            ]
        );
    }

    #[test]
    fn inbox_and_missing_categories_cannot_be_deleted() {
        let mut database = Database::open_in_memory().unwrap();
        let now = Utc.with_ymd_and_hms(2026, 7, 27, 12, 0, 0).unwrap();

        assert!(matches!(
            database.delete_category(CategoryId::INBOX, now),
            Err(StorageError::Domain(DomainError::CannotDeleteInbox))
        ));

        let missing = CategoryId::new();
        assert!(matches!(
            database.delete_category(missing, now),
            Err(StorageError::CategoryNotFound { id }) if id == missing
        ));
    }

    #[test]
    fn category_delete_and_task_migration_are_atomic() {
        let mut database = Database::open_in_memory().unwrap();
        let work = database.create_category("Work").unwrap();
        let work_id = work.id().as_uuid().to_string();
        insert_task(
            &database.connection,
            "10000000-0000-0000-0000-000000000004",
            &work_id,
            0,
            "2026-07-27T11:00:00.000000Z",
        );
        database
            .connection
            .execute_batch(&format!(
                "CREATE TRIGGER block_category_delete BEFORE DELETE ON categories
                 WHEN OLD.id = '{work_id}' BEGIN SELECT RAISE(ABORT, 'blocked'); END;"
            ))
            .unwrap();

        let now = Utc.with_ymd_and_hms(2026, 7, 27, 12, 0, 0).unwrap();
        assert!(matches!(
            database.delete_category(work.id(), now),
            Err(StorageError::Sqlite(_))
        ));

        assert!(database.category(work.id()).unwrap().is_some());
        assert_eq!(
            database
                .connection
                .query_row(
                    "SELECT category_id FROM tasks WHERE id = ?1",
                    ["10000000-0000-0000-0000-000000000004"],
                    |row| row.get::<_, String>(0),
                )
                .unwrap(),
            work_id
        );
    }

    #[test]
    fn missing_inbox_is_reported_as_corrupt_storage() {
        let mut database = Database::open_in_memory().unwrap();
        database
            .connection
            .execute(
                "DELETE FROM categories WHERE id = ?1",
                [CategoryId::INBOX.as_uuid().to_string()],
            )
            .unwrap();

        assert_corrupt(database.list_categories());
        assert_corrupt(database.create_category("Work"));
    }

    #[test]
    fn negative_duplicate_and_gapped_positions_are_reported_as_corrupt_storage() {
        let database = Database::open_in_memory().unwrap();
        database
            .connection
            .execute("UPDATE categories SET position = -1", [])
            .unwrap();
        assert_corrupt(database.list_categories());

        let mut database = Database::open_in_memory().unwrap();
        let work = database.create_category("Work").unwrap();
        database
            .connection
            .execute(
                "UPDATE categories SET position = 0 WHERE id = ?1",
                [work.id().as_uuid().to_string()],
            )
            .unwrap();
        assert_corrupt(database.list_categories());

        let mut database = Database::open_in_memory().unwrap();
        let work = database.create_category("Work").unwrap();
        database
            .connection
            .execute(
                "UPDATE categories SET position = 2 WHERE id = ?1",
                [work.id().as_uuid().to_string()],
            )
            .unwrap();
        assert_corrupt(database.create_category("Personal"));
    }

    #[test]
    fn unicode_duplicate_names_in_existing_data_are_reported_as_corrupt_storage() {
        let mut database = Database::open_in_memory().unwrap();
        database.create_category("École").unwrap();
        database
            .connection
            .execute(
                "INSERT INTO categories (id, name, position, kind)
                 VALUES (?1, 'éCOLE', 2, 'user')",
                [CategoryId::new().as_uuid().to_string()],
            )
            .unwrap();

        assert_corrupt(database.list_categories());
    }

    fn insert_task(
        connection: &rusqlite::Connection,
        id: &str,
        category_id: &str,
        position: i64,
        updated_at: &str,
    ) {
        connection
            .execute(
                "INSERT INTO tasks
                 (id, title, status, category_id, position, created_at, updated_at)
                 VALUES (?1, 'Task', 'open', ?2, ?3, '2026-07-27T10:00:00.000000Z', ?4)",
                params![id, category_id, position, updated_at],
            )
            .unwrap();
    }

    fn assert_corrupt<T>(result: Result<T, StorageError>) {
        assert!(matches!(
            result,
            Err(StorageError::CorruptCategoryStore { .. })
        ));
    }

    fn temporary_database_path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("smartspace-categories-{}.sqlite", Uuid::new_v4()))
    }

    fn remove_database_files(path: &std::path::Path) {
        fs::remove_file(path).unwrap();
        let _ = fs::remove_file(path.with_extension("sqlite-wal"));
        let _ = fs::remove_file(path.with_extension("sqlite-shm"));
    }
}
