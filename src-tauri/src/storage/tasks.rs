use std::collections::{HashMap, HashSet};

use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use rusqlite::{params, Connection, TransactionBehavior};
use uuid::Uuid;

use super::{categories::list_categories, Database, StorageError};
use crate::domain::{CategoryId, Task, TaskId, TaskStatus, TaskTitle};

impl Database {
    pub fn list_tasks(&self) -> Result<Vec<Task>, StorageError> {
        let transaction = self.connection.unchecked_transaction()?;
        let tasks = list_tasks(&transaction)?;
        transaction.commit()?;
        Ok(tasks)
    }

    pub fn tasks_in_category(&self, category_id: CategoryId) -> Result<Vec<Task>, StorageError> {
        let transaction = self.connection.unchecked_transaction()?;
        let categories = list_categories(&transaction)?;
        ensure_category_in(&categories, category_id)?;
        let tasks = list_tasks_with_categories(&transaction, &categories)?
            .into_iter()
            .filter(|task| task.category_id() == category_id)
            .collect();
        transaction.commit()?;
        Ok(tasks)
    }

    pub fn task(&self, id: TaskId) -> Result<Option<Task>, StorageError> {
        let transaction = self.connection.unchecked_transaction()?;
        let task = list_tasks(&transaction)?
            .into_iter()
            .find(|task| task.id() == id);
        transaction.commit()?;
        Ok(task)
    }

    pub fn create_task(
        &mut self,
        title: impl Into<String>,
        category_id: CategoryId,
        now: DateTime<Utc>,
    ) -> Result<Task, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        ensure_category_exists(&transaction, category_id)?;
        let tasks = list_tasks(&transaction)?;
        let position = i64::try_from(
            tasks
                .iter()
                .filter(|task| task.category_id() == category_id)
                .count(),
        )
        .map_err(|_| StorageError::CorruptTaskStore {
            reason: "task count exceeds supported position range",
        })?;
        let task = Task::new(title, category_id, position, now)?;

        insert_task(&transaction, &task)?;
        transaction.commit()?;
        Ok(task)
    }

    pub fn rename_task(
        &mut self,
        id: TaskId,
        title: impl Into<String>,
        now: DateTime<Utc>,
    ) -> Result<Task, StorageError> {
        self.mutate_task(id, |task| {
            task.rename(title, now)?;
            Ok(())
        })
    }

    pub fn set_task_status(
        &mut self,
        id: TaskId,
        status: TaskStatus,
        now: DateTime<Utc>,
    ) -> Result<Task, StorageError> {
        self.mutate_task(id, |task| {
            match status {
                TaskStatus::Open => task.reopen(now),
                TaskStatus::Completed => task.complete(now),
            };
            Ok(())
        })
    }

    pub fn set_task_due_date(
        &mut self,
        id: TaskId,
        due_date: Option<NaiveDate>,
        now: DateTime<Utc>,
    ) -> Result<Task, StorageError> {
        self.mutate_task(id, |task| {
            task.set_due_date(due_date, now);
            Ok(())
        })
    }

    pub fn move_task(
        &mut self,
        id: TaskId,
        category_id: CategoryId,
        now: DateTime<Utc>,
    ) -> Result<Task, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        ensure_category_exists(&transaction, category_id)?;
        let tasks = list_tasks(&transaction)?;
        let mut task = tasks
            .iter()
            .find(|task| task.id() == id)
            .cloned()
            .ok_or(StorageError::TaskNotFound { id })?;

        if task.category_id() == category_id {
            transaction.commit()?;
            return Ok(task);
        }

        let source_category_id = task.category_id();
        let source_position = task.position();
        let target_position = i64::try_from(
            tasks
                .iter()
                .filter(|candidate| candidate.category_id() == category_id)
                .count(),
        )
        .map_err(|_| StorageError::CorruptTaskStore {
            reason: "task count exceeds supported position range",
        })?;
        task.move_to_category(category_id, now);
        task.reposition(target_position, now);
        persist_task(&transaction, &task)?;
        transaction.execute(
            "UPDATE tasks SET position = position - 1
             WHERE category_id = ?1 AND position > ?2",
            params![source_category_id.as_uuid().to_string(), source_position],
        )?;
        transaction.commit()?;
        Ok(task)
    }

    pub fn reorder_tasks(
        &mut self,
        category_id: CategoryId,
        ordered_ids: &[TaskId],
        now: DateTime<Utc>,
    ) -> Result<Vec<Task>, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        ensure_category_exists(&transaction, category_id)?;
        let tasks = list_tasks(&transaction)?;
        let mut category_tasks: Vec<_> = tasks
            .into_iter()
            .filter(|task| task.category_id() == category_id)
            .collect();
        let existing_ids: HashSet<_> = category_tasks.iter().map(Task::id).collect();
        let ordered_set: HashSet<_> = ordered_ids.iter().copied().collect();

        if ordered_ids.len() != category_tasks.len()
            || ordered_set.len() != ordered_ids.len()
            || ordered_set != existing_ids
        {
            return Err(StorageError::InvalidTaskOrder);
        }

        let tasks_by_id: HashMap<_, _> = category_tasks
            .drain(..)
            .map(|task| (task.id(), task))
            .collect();
        let mut reordered = Vec::with_capacity(ordered_ids.len());
        for (position, id) in ordered_ids.iter().enumerate() {
            let mut task = tasks_by_id[id].clone();
            if task.reposition(position as i64, now) {
                persist_task(&transaction, &task)?;
            }
            reordered.push(task);
        }

        transaction.commit()?;
        Ok(reordered)
    }

    pub fn delete_task(&mut self, id: TaskId) -> Result<Task, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let tasks = list_tasks(&transaction)?;
        let task = tasks
            .into_iter()
            .find(|task| task.id() == id)
            .ok_or(StorageError::TaskNotFound { id })?;
        transaction.execute(
            "DELETE FROM tasks WHERE id = ?1",
            [id.as_uuid().to_string()],
        )?;
        transaction.execute(
            "UPDATE tasks SET position = position - 1
             WHERE category_id = ?1 AND position > ?2",
            params![task.category_id().as_uuid().to_string(), task.position()],
        )?;
        transaction.commit()?;
        Ok(task)
    }

    fn mutate_task(
        &mut self,
        id: TaskId,
        mutate: impl FnOnce(&mut Task) -> Result<(), StorageError>,
    ) -> Result<Task, StorageError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let tasks = list_tasks(&transaction)?;
        let mut task = tasks
            .into_iter()
            .find(|task| task.id() == id)
            .ok_or(StorageError::TaskNotFound { id })?;
        mutate(&mut task)?;
        persist_task(&transaction, &task)?;
        transaction.commit()?;
        Ok(task)
    }
}

fn list_tasks(connection: &Connection) -> Result<Vec<Task>, StorageError> {
    let categories = list_categories(connection)?;
    list_tasks_with_categories(connection, &categories)
}

fn list_tasks_with_categories(
    connection: &Connection,
    categories: &[crate::domain::Category],
) -> Result<Vec<Task>, StorageError> {
    let mut statement = connection.prepare(
        "SELECT t.id, t.title, t.status, t.due_date, t.category_id, t.position,
                t.created_at, t.updated_at
         FROM tasks t
         LEFT JOIN categories c ON c.id = t.category_id
         ORDER BY c.position ASC, t.category_id ASC, t.position ASC, t.id ASC",
    )?;
    let records = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let tasks = records
        .into_iter()
        .map(task_from_record)
        .collect::<Result<Vec<_>, _>>()?;
    validate_task_store(&tasks, categories)?;
    Ok(tasks)
}

#[allow(clippy::type_complexity)]
fn task_from_record(
    (id, title, status, due_date, category_id, position, created_at, updated_at): (
        String,
        String,
        String,
        Option<String>,
        String,
        i64,
        String,
        String,
    ),
) -> Result<Task, StorageError> {
    let id = TaskId::from_uuid(Uuid::parse_str(&id)?);
    let stored_title = title;
    let title = TaskTitle::new(stored_title.clone())?;
    if title.as_str() != stored_title {
        return Err(StorageError::CorruptTaskStore {
            reason: "task titles must already be trimmed",
        });
    }
    let status = match status.as_str() {
        "open" => TaskStatus::Open,
        "completed" => TaskStatus::Completed,
        _ => return Err(StorageError::InvalidTaskStatus(status)),
    };
    let due_date = due_date
        .map(|date| {
            NaiveDate::parse_from_str(&date, "%Y-%m-%d")
                .map_err(|_| StorageError::InvalidTaskDate(date))
        })
        .transpose()?;
    let category_id = CategoryId::from_uuid(Uuid::parse_str(&category_id)?);
    let created_at = DateTime::parse_from_rfc3339(&created_at)?.with_timezone(&Utc);
    let updated_at = DateTime::parse_from_rfc3339(&updated_at)?.with_timezone(&Utc);
    Ok(Task::restore(
        id,
        title,
        status,
        due_date,
        category_id,
        position,
        created_at,
        updated_at,
    )?)
}

fn validate_task_store(
    tasks: &[Task],
    categories: &[crate::domain::Category],
) -> Result<(), StorageError> {
    let category_ids: HashSet<_> = categories.iter().map(|category| category.id()).collect();
    let mut expected_positions = HashMap::<CategoryId, i64>::new();
    for task in tasks {
        if !category_ids.contains(&task.category_id()) {
            return Err(StorageError::CorruptTaskStore {
                reason: "every task must reference an existing category",
            });
        }
        let expected = expected_positions.entry(task.category_id()).or_default();
        if task.position() != *expected {
            return Err(StorageError::CorruptTaskStore {
                reason: "task positions in each category must be the contiguous range 0..n-1",
            });
        }
        *expected += 1;
    }
    Ok(())
}

fn ensure_category_exists(
    connection: &Connection,
    category_id: CategoryId,
) -> Result<(), StorageError> {
    let categories = list_categories(connection)?;
    ensure_category_in(&categories, category_id)
}

fn ensure_category_in(
    categories: &[crate::domain::Category],
    category_id: CategoryId,
) -> Result<(), StorageError> {
    if categories
        .iter()
        .any(|category| category.id() == category_id)
    {
        Ok(())
    } else {
        Err(StorageError::CategoryNotFound { id: category_id })
    }
}

fn insert_task(connection: &Connection, task: &Task) -> Result<(), StorageError> {
    connection.execute(
        "INSERT INTO tasks
         (id, title, status, due_date, category_id, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        task_params(task),
    )?;
    Ok(())
}

fn persist_task(connection: &Connection, task: &Task) -> Result<(), StorageError> {
    connection.execute(
        "UPDATE tasks SET title = ?2, status = ?3, due_date = ?4, category_id = ?5,
                          position = ?6, created_at = ?7, updated_at = ?8
         WHERE id = ?1",
        task_params(task),
    )?;
    Ok(())
}

fn task_params(task: &Task) -> [rusqlite::types::Value; 8] {
    [
        task.id().as_uuid().to_string().into(),
        task.title().as_str().to_owned().into(),
        task_status_value(task.status()).into(),
        task.due_date()
            .map(|date| date.format("%Y-%m-%d").to_string())
            .into(),
        task.category_id().as_uuid().to_string().into(),
        task.position().into(),
        task.created_at()
            .to_rfc3339_opts(SecondsFormat::Nanos, true)
            .into(),
        task.updated_at()
            .to_rfc3339_opts(SecondsFormat::Nanos, true)
            .into(),
    ]
}

fn task_status_value(status: TaskStatus) -> String {
    match status {
        TaskStatus::Open => "open",
        TaskStatus::Completed => "completed",
    }
    .to_owned()
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        sync::{Arc, Barrier},
        thread,
    };

    use chrono::{Duration, NaiveDate, TimeZone, Timelike, Utc};
    use uuid::Uuid;

    use super::{list_tasks_with_categories, Database};
    use crate::storage::categories::list_categories;
    use crate::{
        domain::{CategoryId, TaskId, TaskStatus},
        storage::StorageError,
    };

    fn now() -> chrono::DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 7, 27, 12, 0, 0).unwrap()
    }

    #[test]
    fn tasks_round_trip_and_persist_after_reopening() {
        let path = temporary_database_path();
        let task_id = {
            let mut database = Database::open(&path).unwrap();
            let work = database.create_category("Work").unwrap();
            let task = database
                .create_task("  Write tests  ", work.id(), now())
                .unwrap();
            assert_eq!(task.title().as_str(), "Write tests");
            assert_eq!(task.position(), 0);
            assert_eq!(database.task(task.id()).unwrap(), Some(task.clone()));
            assert_eq!(
                database.tasks_in_category(work.id()).unwrap(),
                vec![task.clone()]
            );
            task.id()
        };

        let database = Database::open(&path).unwrap();
        assert_eq!(database.list_tasks().unwrap().len(), 1);
        assert_eq!(
            database.task(task_id).unwrap().unwrap().title().as_str(),
            "Write tests"
        );
        drop(database);
        remove_database_files(&path);
    }

    #[test]
    fn nanosecond_timestamps_round_trip_without_truncation() {
        let mut database = Database::open_in_memory().unwrap();
        let precise_now = now().with_nanosecond(123_456_789).unwrap();
        let task = database
            .create_task("Precise", CategoryId::INBOX, precise_now)
            .unwrap();

        assert_eq!(task.created_at(), precise_now);
        assert_eq!(task.updated_at(), precise_now);
        assert_eq!(database.task(task.id()).unwrap(), Some(task));
    }

    #[test]
    fn task_fields_can_be_mutated_without_moving_time_backwards() {
        let mut database = Database::open_in_memory().unwrap();
        let task = database
            .create_task("Write tests", CategoryId::INBOX, now())
            .unwrap();
        let due_date = NaiveDate::from_ymd_opt(2026, 7, 31).unwrap();

        let renamed = database
            .rename_task(task.id(), "Review tests", now() + Duration::minutes(1))
            .unwrap();
        let completed = database
            .set_task_status(
                task.id(),
                TaskStatus::Completed,
                now() + Duration::minutes(2),
            )
            .unwrap();
        let dated = database
            .set_task_due_date(task.id(), Some(due_date), now() + Duration::minutes(3))
            .unwrap();
        let unchanged = database
            .set_task_status(task.id(), TaskStatus::Completed, now() - Duration::hours(1))
            .unwrap();

        assert_eq!(renamed.title().as_str(), "Review tests");
        assert_eq!(completed.status(), TaskStatus::Completed);
        assert_eq!(dated.due_date(), Some(due_date));
        assert_eq!(unchanged.updated_at(), now() + Duration::minutes(3));
        assert_eq!(database.task(task.id()).unwrap(), Some(unchanged));
    }

    #[test]
    fn missing_categories_and_tasks_return_typed_errors() {
        let mut database = Database::open_in_memory().unwrap();
        let missing_category = CategoryId::new();
        assert!(matches!(
            database.create_task("Task", missing_category, now()),
            Err(StorageError::CategoryNotFound { id }) if id == missing_category
        ));

        let task = database
            .create_task("Task", CategoryId::INBOX, now())
            .unwrap();
        assert!(matches!(
            database.move_task(task.id(), missing_category, now()),
            Err(StorageError::CategoryNotFound { id }) if id == missing_category
        ));

        let missing_task = TaskId::new();
        assert!(matches!(
            database.rename_task(missing_task, "Missing", now()),
            Err(StorageError::TaskNotFound { id }) if id == missing_task
        ));
    }

    #[test]
    fn moving_tasks_appends_to_target_and_compacts_source() {
        let mut database = Database::open_in_memory().unwrap();
        let work = database.create_category("Work").unwrap();
        let inbox_a = database
            .create_task("Inbox A", CategoryId::INBOX, now())
            .unwrap();
        let inbox_b = database
            .create_task("Inbox B", CategoryId::INBOX, now())
            .unwrap();
        let work_a = database.create_task("Work A", work.id(), now()).unwrap();
        let work_b = database.create_task("Work B", work.id(), now()).unwrap();

        let moved = database
            .move_task(inbox_a.id(), work.id(), now() + Duration::minutes(1))
            .unwrap();

        assert_eq!(moved.category_id(), work.id());
        assert_eq!(moved.position(), 2);
        assert_eq!(
            database.tasks_in_category(CategoryId::INBOX).unwrap(),
            vec![task_at_position(inbox_b, 0)]
        );
        assert_eq!(
            database
                .tasks_in_category(work.id())
                .unwrap()
                .iter()
                .map(|task| task.id())
                .collect::<Vec<_>>(),
            vec![work_a.id(), work_b.id(), inbox_a.id()]
        );
    }

    #[test]
    fn reorder_requires_the_complete_category_set_and_is_atomic() {
        let mut database = Database::open_in_memory().unwrap();
        let first = database
            .create_task("First", CategoryId::INBOX, now())
            .unwrap();
        let second = database
            .create_task("Second", CategoryId::INBOX, now())
            .unwrap();
        let third = database
            .create_task("Third", CategoryId::INBOX, now())
            .unwrap();
        let before = database.list_tasks().unwrap();

        assert!(matches!(
            database.reorder_tasks(
                CategoryId::INBOX,
                &[first.id(), first.id(), third.id()],
                now(),
            ),
            Err(StorageError::InvalidTaskOrder)
        ));
        assert_eq!(database.list_tasks().unwrap(), before);

        database
            .connection
            .execute_batch(&format!(
                "CREATE TRIGGER block_first_task_update BEFORE UPDATE ON tasks
                 WHEN OLD.id = '{}' BEGIN SELECT RAISE(ABORT, 'blocked'); END;",
                first.id().as_uuid()
            ))
            .unwrap();
        assert!(matches!(
            database.reorder_tasks(
                CategoryId::INBOX,
                &[third.id(), second.id(), first.id()],
                now() + Duration::minutes(1),
            ),
            Err(StorageError::Sqlite(_))
        ));
        assert_eq!(database.list_tasks().unwrap(), before);

        database
            .connection
            .execute_batch("DROP TRIGGER block_first_task_update")
            .unwrap();
        let reordered = database
            .reorder_tasks(
                CategoryId::INBOX,
                &[third.id(), second.id(), first.id()],
                now() + Duration::minutes(1),
            )
            .unwrap();
        assert_eq!(
            reordered.iter().map(|task| task.id()).collect::<Vec<_>>(),
            vec![third.id(), second.id(), first.id()]
        );
        assert_eq!(
            reordered
                .iter()
                .map(|task| task.position())
                .collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
    }

    #[test]
    fn deleting_a_task_compacts_its_category() {
        let mut database = Database::open_in_memory().unwrap();
        let first = database
            .create_task("First", CategoryId::INBOX, now())
            .unwrap();
        let second = database
            .create_task("Second", CategoryId::INBOX, now())
            .unwrap();
        let third = database
            .create_task("Third", CategoryId::INBOX, now())
            .unwrap();

        assert_eq!(database.delete_task(second.id()).unwrap(), second);
        let tasks = database.list_tasks().unwrap();
        assert_eq!(tasks, vec![first, task_at_position(third, 1)]);
        assert!(matches!(
            database.delete_task(second.id()),
            Err(StorageError::TaskNotFound { .. })
        ));
    }

    #[test]
    fn corrupt_positions_dates_and_timestamps_are_rejected() {
        let mut database = Database::open_in_memory().unwrap();
        let task = database
            .create_task("Task", CategoryId::INBOX, now())
            .unwrap();
        database
            .connection
            .execute(
                "UPDATE tasks SET position = -1 WHERE id = ?1",
                [task.id().as_uuid().to_string()],
            )
            .unwrap();
        assert!(matches!(
            database.list_tasks(),
            Err(StorageError::CorruptTaskStore { .. })
        ));

        let mut database = Database::open_in_memory().unwrap();
        let task = database
            .create_task("Task", CategoryId::INBOX, now())
            .unwrap();
        database
            .connection
            .execute(
                "UPDATE tasks SET due_date = '2026-99-99' WHERE id = ?1",
                [task.id().as_uuid().to_string()],
            )
            .unwrap();
        assert!(matches!(
            database.list_tasks(),
            Err(StorageError::InvalidTaskDate(_))
        ));

        let mut database = Database::open_in_memory().unwrap();
        let task = database
            .create_task("Task", CategoryId::INBOX, now())
            .unwrap();
        database
            .connection
            .execute(
                "UPDATE tasks SET updated_at = 'not-a-time' WHERE id = ?1",
                [task.id().as_uuid().to_string()],
            )
            .unwrap();
        assert!(matches!(
            database.list_tasks(),
            Err(StorageError::InvalidTimestamp(_))
        ));
    }

    #[test]
    fn orphan_tasks_are_reported_instead_of_hidden() {
        let database = Database::open_in_memory().unwrap();
        database
            .connection
            .pragma_update(None, "foreign_keys", false)
            .unwrap();
        database
            .connection
            .execute(
                "INSERT INTO tasks
                 (id, title, status, category_id, position, created_at, updated_at)
                 VALUES (?1, 'Orphan', 'open', ?2, 0, ?3, ?3)",
                rusqlite::params![
                    TaskId::new().as_uuid().to_string(),
                    CategoryId::new().as_uuid().to_string(),
                    "2026-07-27T12:00:00Z"
                ],
            )
            .unwrap();
        database
            .connection
            .pragma_update(None, "foreign_keys", true)
            .unwrap();

        assert!(matches!(
            database.list_tasks(),
            Err(StorageError::CorruptTaskStore { .. })
        ));
    }

    #[test]
    fn noncanonical_stored_titles_and_category_names_are_rejected() {
        let mut database = Database::open_in_memory().unwrap();
        let task = database
            .create_task("Task", CategoryId::INBOX, now())
            .unwrap();
        database
            .connection
            .execute(
                "UPDATE tasks SET title = '  Task  ' WHERE id = ?1",
                [task.id().as_uuid().to_string()],
            )
            .unwrap();
        assert!(matches!(
            database.list_tasks(),
            Err(StorageError::CorruptTaskStore { .. })
        ));

        let database = Database::open_in_memory().unwrap();
        database
            .connection
            .execute(
                "UPDATE categories SET name = '  Inbox  ' WHERE id = ?1",
                [CategoryId::INBOX.as_uuid().to_string()],
            )
            .unwrap();
        assert!(matches!(
            database.list_tasks(),
            Err(StorageError::CorruptCategoryStore { .. })
        ));
    }

    #[test]
    fn multi_statement_reads_use_one_wal_snapshot() {
        let path = temporary_database_path();
        let work_id = {
            let mut setup = Database::open(&path).unwrap();
            let work = setup.create_category("Work").unwrap();
            setup.create_task("Task", work.id(), now()).unwrap();
            work.id()
        };

        let reader = Database::open(&path).unwrap();
        let snapshot = reader.connection.unchecked_transaction().unwrap();
        let categories = list_categories(&snapshot).unwrap();

        let mut writer = Database::open(&path).unwrap();
        writer.delete_category(work_id, now()).unwrap();

        let snapshot_tasks = list_tasks_with_categories(&snapshot, &categories).unwrap();
        assert_eq!(snapshot_tasks.len(), 1);
        assert_eq!(snapshot_tasks[0].category_id(), work_id);
        snapshot.commit().unwrap();

        assert!(matches!(
            reader.tasks_in_category(work_id),
            Err(StorageError::CategoryNotFound { id }) if id == work_id
        ));
        drop(writer);
        drop(reader);
        remove_database_files(&path);
    }

    #[test]
    fn concurrent_creates_receive_distinct_contiguous_positions() {
        const WORKER_COUNT: usize = 4;

        let path = temporary_database_path();
        drop(Database::open(&path).unwrap());
        let barrier = Arc::new(Barrier::new(WORKER_COUNT));
        let workers: Vec<_> = (0..WORKER_COUNT)
            .map(|index| {
                let path = path.clone();
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    let mut database = Database::open(path).unwrap();
                    barrier.wait();
                    database.create_task(format!("Task {index}"), CategoryId::INBOX, now())
                })
            })
            .collect();

        for worker in workers {
            worker.join().unwrap().unwrap();
        }
        let database = Database::open(&path).unwrap();
        assert_eq!(
            database
                .list_tasks()
                .unwrap()
                .iter()
                .map(|task| task.position())
                .collect::<Vec<_>>(),
            vec![0, 1, 2, 3]
        );
        drop(database);
        remove_database_files(&path);
    }

    fn task_at_position(mut task: crate::domain::Task, position: i64) -> crate::domain::Task {
        task.reposition(position, task.updated_at());
        task
    }

    fn temporary_database_path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("smartspace-tasks-{}.sqlite", Uuid::new_v4()))
    }

    fn remove_database_files(path: &std::path::Path) {
        fs::remove_file(path).unwrap();
        let _ = fs::remove_file(path.with_extension("sqlite-wal"));
        let _ = fs::remove_file(path.with_extension("sqlite-shm"));
    }
}
