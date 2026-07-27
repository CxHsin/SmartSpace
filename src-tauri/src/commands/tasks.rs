use tauri::State;

use super::CommandError;
use crate::{
    domain::Task,
    storage::{DatabaseRuntimeError, DatabaseState},
};

#[tauri::command]
pub(crate) fn list_tasks(
    database_state: State<'_, DatabaseState>,
) -> Result<Vec<Task>, CommandError> {
    list_tasks_from_state(database_state.inner())
}

fn list_tasks_from_state(database_state: &DatabaseState) -> Result<Vec<Task>, CommandError> {
    let database = database_state.lock().map_err(CommandError::from)?;
    database
        .list_tasks()
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use chrono::{DateTime, NaiveDate, Utc};
    use rusqlite::{params, Connection};
    use uuid::Uuid;

    use super::list_tasks_from_state;
    use crate::{
        commands::CommandErrorCode,
        domain::CategoryId,
        storage::{DatabaseState, DATABASE_FILE_NAME},
    };

    #[test]
    fn list_tasks_returns_complete_domain_objects_in_storage_order() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let now = timestamp("2026-07-27T12:00:00.123456789Z");
        let category = state.lock().unwrap().create_category("Work").unwrap();
        let inbox_first = state
            .lock()
            .unwrap()
            .create_task("Inbox first", CategoryId::INBOX, now)
            .unwrap();
        state
            .lock()
            .unwrap()
            .create_task("Inbox second", CategoryId::INBOX, now)
            .unwrap();
        state
            .lock()
            .unwrap()
            .create_task("Work first", category.id(), now)
            .unwrap();
        state
            .lock()
            .unwrap()
            .set_task_due_date(
                inbox_first.id(),
                Some(NaiveDate::from_ymd_opt(2026, 7, 30).unwrap()),
                timestamp("2026-07-27T12:00:01.000000001Z"),
            )
            .unwrap();
        state
            .lock()
            .unwrap()
            .set_task_status(
                inbox_first.id(),
                crate::domain::TaskStatus::Completed,
                timestamp("2026-07-27T12:00:02.987654321Z"),
            )
            .unwrap();

        let tasks = list_tasks_from_state(&state).unwrap();

        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].title().as_str(), "Inbox first");
        assert_eq!(tasks[1].title().as_str(), "Inbox second");
        assert_eq!(tasks[2].title().as_str(), "Work first");
        assert_eq!(
            serde_json::to_value(&tasks[0]).unwrap(),
            serde_json::json!({
                "id": inbox_first.id().as_uuid().to_string(),
                "title": "Inbox first",
                "status": "completed",
                "dueDate": "2026-07-30",
                "categoryId": CategoryId::INBOX.as_uuid().to_string(),
                "position": 0,
                "createdAt": "2026-07-27T12:00:00.123456789Z",
                "updatedAt": "2026-07-27T12:00:02.987654321Z"
            })
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn list_tasks_treats_invalid_persisted_ids_as_corrupt_data() {
        let root = temporary_root();
        drop(DatabaseState::initialize(&root).unwrap());
        let connection = Connection::open(root.join(DATABASE_FILE_NAME)).unwrap();
        connection
            .execute(
                "INSERT INTO tasks (
                    id, title, status, due_date, category_id, position, created_at, updated_at
                 ) VALUES (?1, 'Broken', 'open', NULL, ?2, 0, ?3, ?3)",
                params![
                    "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
                    CategoryId::INBOX.as_uuid().to_string(),
                    "2026-07-27T12:00:00.000000000Z"
                ],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = list_tasks_from_state(&state).unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    fn timestamp(value: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(value)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn temporary_root() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("smartspace-task-command-{}", Uuid::new_v4()))
    }
}
