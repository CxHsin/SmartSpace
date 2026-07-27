use chrono::{DateTime, Utc};
use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::{
    domain::{CategoryId, Task, TaskTitle},
    storage::{DatabaseRuntimeError, DatabaseState},
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateTaskRequest {
    title: String,
    category_id: String,
}

#[tauri::command]
pub(crate) fn create_task(
    database_state: State<'_, DatabaseState>,
    request: CreateTaskRequest,
) -> Result<Task, CommandError> {
    create_task_from_state(database_state.inner(), request, Utc::now())
}

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

fn create_task_from_state(
    database_state: &DatabaseState,
    request: CreateTaskRequest,
    now: DateTime<Utc>,
) -> Result<Task, CommandError> {
    let title = TaskTitle::new(request.title)
        .map_err(|error| CommandError::invalid_input(error.to_string()))?;
    let category_id = Uuid::parse_str(&request.category_id)
        .map(CategoryId::from_uuid)
        .map_err(|_| CommandError::invalid_input("categoryId must be a valid UUID"))?;

    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .create_task(title.as_str(), category_id, now)
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use chrono::{DateTime, NaiveDate, Utc};
    use rusqlite::{params, Connection};
    use uuid::Uuid;

    use super::{create_task_from_state, list_tasks_from_state, CreateTaskRequest};
    use crate::{
        commands::CommandErrorCode,
        domain::CategoryId,
        storage::{DatabaseState, DATABASE_FILE_NAME},
    };

    #[test]
    fn create_task_validates_normalizes_and_persists_the_request() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let now = timestamp("2026-07-28T01:02:03.123456789Z");
        let request: CreateTaskRequest = serde_json::from_value(serde_json::json!({
            "title": "  Write tests  ",
            "categoryId": CategoryId::INBOX.as_uuid().to_string()
        }))
        .unwrap();

        let created = create_task_from_state(&state, request, now).unwrap();

        assert_eq!(created.title().as_str(), "Write tests");
        assert_eq!(created.category_id(), CategoryId::INBOX);
        assert_eq!(created.position(), 0);
        assert_eq!(created.created_at(), now);
        assert_eq!(created.updated_at(), now);
        assert_eq!(state.lock().unwrap().list_tasks().unwrap(), vec![created]);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_task_rejects_invalid_input_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let now = timestamp("2026-07-28T01:02:03.000000000Z");

        let blank_title = create_task_from_state(
            &state,
            CreateTaskRequest {
                title: "  ".to_owned(),
                category_id: CategoryId::INBOX.as_uuid().to_string(),
            },
            now,
        )
        .unwrap_err();
        let invalid_category = create_task_from_state(
            &state,
            CreateTaskRequest {
                title: "Valid".to_owned(),
                category_id: "not-a-uuid".to_owned(),
            },
            now,
        )
        .unwrap_err();

        assert_eq!(blank_title.code, CommandErrorCode::InvalidInput);
        assert_eq!(invalid_category.code, CommandErrorCode::InvalidInput);
        assert!(state.lock().unwrap().list_tasks().unwrap().is_empty());

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_task_reports_a_missing_category_with_a_stable_code() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let missing_category = CategoryId::new();

        let error = create_task_from_state(
            &state,
            CreateTaskRequest {
                title: "Task".to_owned(),
                category_id: missing_category.as_uuid().to_string(),
            },
            timestamp("2026-07-28T01:02:03.000000000Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::CategoryNotFound);
        assert_eq!(
            serde_json::to_value(error).unwrap()["code"],
            "category_not_found"
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_task_keeps_persisted_corruption_distinct_from_invalid_input() {
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

        let error = create_task_from_state(
            &state,
            CreateTaskRequest {
                title: "Valid".to_owned(),
                category_id: CategoryId::INBOX.as_uuid().to_string(),
            },
            timestamp("2026-07-28T01:02:03.000000000Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

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
