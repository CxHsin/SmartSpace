use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::{
    domain::{CategoryId, Task, TaskId, TaskStatus, TaskTitle},
    storage::{DatabaseRuntimeError, DatabaseState, StorageError},
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateTaskRequest {
    title: String,
    category_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetTaskStatusRequest {
    task_id: String,
    status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenameTaskRequest {
    task_id: String,
    title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetTaskDueDateRequest {
    task_id: String,
    due_date: RequiredOptionalDate,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MoveTaskRequest {
    task_id: String,
    category_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReorderTasksRequest {
    category_id: String,
    ordered_task_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum RequiredOptionalDate {
    Date(String),
    Null(()),
}

#[tauri::command]
pub(crate) fn create_task(
    database_state: State<'_, DatabaseState>,
    request: CreateTaskRequest,
) -> Result<Task, CommandError> {
    create_task_from_state(database_state.inner(), request, Utc::now())
}

#[tauri::command]
pub(crate) fn set_task_status(
    database_state: State<'_, DatabaseState>,
    request: SetTaskStatusRequest,
) -> Result<Task, CommandError> {
    set_task_status_from_state(database_state.inner(), request, Utc::now())
}

#[tauri::command]
pub(crate) fn rename_task(
    database_state: State<'_, DatabaseState>,
    request: RenameTaskRequest,
) -> Result<Task, CommandError> {
    rename_task_from_state(database_state.inner(), request, Utc::now())
}

#[tauri::command]
pub(crate) fn set_task_due_date(
    database_state: State<'_, DatabaseState>,
    request: SetTaskDueDateRequest,
) -> Result<Task, CommandError> {
    set_task_due_date_from_state(database_state.inner(), request, Utc::now())
}

#[tauri::command]
pub(crate) fn move_task(
    database_state: State<'_, DatabaseState>,
    request: MoveTaskRequest,
) -> Result<Task, CommandError> {
    move_task_from_state(database_state.inner(), request, Utc::now())
}

#[tauri::command]
pub(crate) fn reorder_tasks(
    database_state: State<'_, DatabaseState>,
    request: ReorderTasksRequest,
) -> Result<Vec<Task>, CommandError> {
    reorder_tasks_from_state(database_state.inner(), request, Utc::now())
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

fn set_task_status_from_state(
    database_state: &DatabaseState,
    request: SetTaskStatusRequest,
    now: DateTime<Utc>,
) -> Result<Task, CommandError> {
    let task_id = Uuid::parse_str(&request.task_id)
        .map(TaskId::from_uuid)
        .map_err(|_| CommandError::invalid_input("taskId must be a valid UUID"))?;
    let status = match request.status.as_str() {
        "open" => TaskStatus::Open,
        "completed" => TaskStatus::Completed,
        _ => {
            return Err(CommandError::invalid_input(
                "status must be either open or completed",
            ));
        }
    };

    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .set_task_status(task_id, status, now)
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

fn rename_task_from_state(
    database_state: &DatabaseState,
    request: RenameTaskRequest,
    now: DateTime<Utc>,
) -> Result<Task, CommandError> {
    let task_id = Uuid::parse_str(&request.task_id)
        .map(TaskId::from_uuid)
        .map_err(|_| CommandError::invalid_input("taskId must be a valid UUID"))?;
    let title = TaskTitle::new(request.title)
        .map_err(|error| CommandError::invalid_input(error.to_string()))?;

    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .rename_task(task_id, title.as_str(), now)
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

fn set_task_due_date_from_state(
    database_state: &DatabaseState,
    request: SetTaskDueDateRequest,
    now: DateTime<Utc>,
) -> Result<Task, CommandError> {
    let task_id = Uuid::parse_str(&request.task_id)
        .map(TaskId::from_uuid)
        .map_err(|_| CommandError::invalid_input("taskId must be a valid UUID"))?;
    let due_date = match request.due_date {
        RequiredOptionalDate::Null(()) => None,
        RequiredOptionalDate::Date(value) => {
            let bytes = value.as_bytes();
            let has_canonical_shape = bytes.len() == 10
                && bytes[4] == b'-'
                && bytes[7] == b'-'
                && bytes[..4].iter().all(u8::is_ascii_digit)
                && bytes[5..7].iter().all(u8::is_ascii_digit)
                && bytes[8..].iter().all(u8::is_ascii_digit);
            if !has_canonical_shape {
                return Err(CommandError::invalid_input("dueDate must use YYYY-MM-DD"));
            }

            Some(NaiveDate::parse_from_str(&value, "%Y-%m-%d").map_err(|_| {
                CommandError::invalid_input("dueDate must be a valid calendar date")
            })?)
        }
    };

    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .set_task_due_date(task_id, due_date, now)
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

fn move_task_from_state(
    database_state: &DatabaseState,
    request: MoveTaskRequest,
    now: DateTime<Utc>,
) -> Result<Task, CommandError> {
    let task_id = Uuid::parse_str(&request.task_id)
        .map(TaskId::from_uuid)
        .map_err(|_| CommandError::invalid_input("taskId must be a valid UUID"))?;
    let category_id = Uuid::parse_str(&request.category_id)
        .map(CategoryId::from_uuid)
        .map_err(|_| CommandError::invalid_input("categoryId must be a valid UUID"))?;

    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .move_task(task_id, category_id, now)
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

fn reorder_tasks_from_state(
    database_state: &DatabaseState,
    request: ReorderTasksRequest,
    now: DateTime<Utc>,
) -> Result<Vec<Task>, CommandError> {
    let category_id = Uuid::parse_str(&request.category_id)
        .map(CategoryId::from_uuid)
        .map_err(|_| CommandError::invalid_input("categoryId must be a valid UUID"))?;
    let ordered_task_ids = request
        .ordered_task_ids
        .iter()
        .map(|value| {
            Uuid::parse_str(value)
                .map(TaskId::from_uuid)
                .map_err(|_| CommandError::invalid_input("orderedTaskIds must contain valid UUIDs"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .reorder_tasks(category_id, &ordered_task_ids, now)
        .map_err(|error| match error {
            StorageError::InvalidTaskOrder => CommandError::invalid_input(error.to_string()),
            error => CommandError::from(DatabaseRuntimeError::from(error)),
        })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use chrono::{DateTime, NaiveDate, Utc};
    use rusqlite::{params, Connection};
    use uuid::Uuid;

    use super::{
        create_task_from_state, list_tasks_from_state, move_task_from_state,
        rename_task_from_state, reorder_tasks_from_state, set_task_due_date_from_state,
        set_task_status_from_state, CreateTaskRequest, MoveTaskRequest, RenameTaskRequest,
        ReorderTasksRequest, RequiredOptionalDate, SetTaskDueDateRequest, SetTaskStatusRequest,
    };

    #[test]
    fn reorder_tasks_persists_the_complete_requested_order() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T06:00:00.000000001Z");
        let reordered_at = timestamp("2026-07-28T06:00:01.000000002Z");
        let first = state
            .lock()
            .unwrap()
            .create_task("First", CategoryId::INBOX, created_at)
            .unwrap();
        let second = state
            .lock()
            .unwrap()
            .create_task("Second", CategoryId::INBOX, created_at)
            .unwrap();
        let third = state
            .lock()
            .unwrap()
            .create_task("Third", CategoryId::INBOX, created_at)
            .unwrap();

        let reordered = reorder_tasks_from_state(
            &state,
            reorder_request(CategoryId::INBOX, &[third.id(), first.id(), second.id()]),
            reordered_at,
        )
        .unwrap();

        assert_eq!(
            reordered.iter().map(|task| task.id()).collect::<Vec<_>>(),
            vec![third.id(), first.id(), second.id()]
        );
        assert_eq!(
            reordered
                .iter()
                .map(|task| task.position())
                .collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
        assert!(reordered
            .iter()
            .all(|task| task.updated_at() == reordered_at));
        assert_eq!(
            state
                .lock()
                .unwrap()
                .tasks_in_category(CategoryId::INBOX)
                .unwrap(),
            reordered
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reorder_tasks_is_idempotent_for_the_current_order() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T06:00:00.000000001Z");
        let first = state
            .lock()
            .unwrap()
            .create_task("First", CategoryId::INBOX, created_at)
            .unwrap();
        let second = state
            .lock()
            .unwrap()
            .create_task("Second", CategoryId::INBOX, created_at)
            .unwrap();

        let unchanged = reorder_tasks_from_state(
            &state,
            reorder_request(CategoryId::INBOX, &[first.id(), second.id()]),
            timestamp("2026-07-28T06:00:01.000000002Z"),
        )
        .unwrap();

        assert_eq!(unchanged, vec![first, second]);
        assert!(unchanged.iter().all(|task| task.updated_at() == created_at));

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reorder_tasks_rejects_invalid_or_incomplete_orders_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T06:00:00.000000001Z");
        let category = state.lock().unwrap().create_category("Work").unwrap();
        let first = state
            .lock()
            .unwrap()
            .create_task("First", CategoryId::INBOX, created_at)
            .unwrap();
        let second = state
            .lock()
            .unwrap()
            .create_task("Second", CategoryId::INBOX, created_at)
            .unwrap();
        let foreign = state
            .lock()
            .unwrap()
            .create_task("Foreign", category.id(), created_at)
            .unwrap();
        let original = vec![first.clone(), second.clone()];
        let now = timestamp("2026-07-28T06:00:01.000000002Z");

        let invalid_uuid = reorder_tasks_from_state(
            &state,
            ReorderTasksRequest {
                category_id: CategoryId::INBOX.as_uuid().to_string(),
                ordered_task_ids: vec!["not-a-uuid".to_owned()],
            },
            now,
        )
        .unwrap_err();
        assert_eq!(invalid_uuid.code, CommandErrorCode::InvalidInput);

        for ids in [
            vec![first.id()],
            vec![first.id(), first.id()],
            vec![first.id(), foreign.id()],
            vec![first.id(), second.id(), crate::domain::TaskId::new()],
        ] {
            let error =
                reorder_tasks_from_state(&state, reorder_request(CategoryId::INBOX, &ids), now)
                    .unwrap_err();
            assert_eq!(error.code, CommandErrorCode::InvalidInput);
        }
        assert_eq!(
            state
                .lock()
                .unwrap()
                .tasks_in_category(CategoryId::INBOX)
                .unwrap(),
            original
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reorder_tasks_reports_a_missing_category_with_a_stable_code() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();

        let error = reorder_tasks_from_state(
            &state,
            reorder_request(CategoryId::new(), &[]),
            timestamp("2026-07-28T06:00:01.000000002Z"),
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
    fn reorder_tasks_keeps_persisted_corruption_distinct_from_invalid_input() {
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
                    "2026-07-28T06:00:00.000000001Z"
                ],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = reorder_tasks_from_state(
            &state,
            reorder_request(CategoryId::INBOX, &[]),
            timestamp("2026-07-28T06:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn move_task_appends_to_target_and_compacts_source_positions() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T05:00:00.000000001Z");
        let moved_at = timestamp("2026-07-28T05:00:01.000000002Z");
        let category = state.lock().unwrap().create_category("Work").unwrap();
        let first = state
            .lock()
            .unwrap()
            .create_task("First", CategoryId::INBOX, created_at)
            .unwrap();
        let second = state
            .lock()
            .unwrap()
            .create_task("Second", CategoryId::INBOX, created_at)
            .unwrap();
        let target = state
            .lock()
            .unwrap()
            .create_task("Target", category.id(), created_at)
            .unwrap();

        let moved = move_task_from_state(&state, move_request(first.id(), category.id()), moved_at)
            .unwrap();

        assert_eq!(moved.category_id(), category.id());
        assert_eq!(moved.position(), 1);
        assert_eq!(moved.updated_at(), moved_at);
        let source_tasks = state
            .lock()
            .unwrap()
            .tasks_in_category(CategoryId::INBOX)
            .unwrap();
        assert_eq!(source_tasks.len(), 1);
        assert_eq!(source_tasks[0].id(), second.id());
        assert_eq!(source_tasks[0].position(), 0);
        assert_eq!(
            state
                .lock()
                .unwrap()
                .tasks_in_category(category.id())
                .unwrap(),
            vec![target, moved]
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn move_task_to_the_same_category_is_idempotent() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T05:00:00.000000001Z");
        let task = state
            .lock()
            .unwrap()
            .create_task("Task", CategoryId::INBOX, created_at)
            .unwrap();

        let unchanged = move_task_from_state(
            &state,
            move_request(task.id(), CategoryId::INBOX),
            timestamp("2026-07-28T05:00:01.000000002Z"),
        )
        .unwrap();

        assert_eq!(unchanged, task);
        assert_eq!(unchanged.updated_at(), created_at);
        assert_eq!(state.lock().unwrap().task(task.id()).unwrap(), Some(task));

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn move_task_rejects_invalid_ids_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T05:00:00.000000001Z");
        let task = state
            .lock()
            .unwrap()
            .create_task("Task", CategoryId::INBOX, created_at)
            .unwrap();

        let invalid_task = move_task_from_state(
            &state,
            MoveTaskRequest {
                task_id: "not-a-uuid".to_owned(),
                category_id: CategoryId::INBOX.as_uuid().to_string(),
            },
            timestamp("2026-07-28T05:00:01.000000002Z"),
        )
        .unwrap_err();
        let invalid_category = move_task_from_state(
            &state,
            MoveTaskRequest {
                task_id: task.id().as_uuid().to_string(),
                category_id: "not-a-uuid".to_owned(),
            },
            timestamp("2026-07-28T05:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(invalid_task.code, CommandErrorCode::InvalidInput);
        assert_eq!(invalid_category.code, CommandErrorCode::InvalidInput);
        assert_eq!(state.lock().unwrap().task(task.id()).unwrap(), Some(task));

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn move_task_reports_missing_entities_with_stable_codes() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let task = state
            .lock()
            .unwrap()
            .create_task(
                "Task",
                CategoryId::INBOX,
                timestamp("2026-07-28T05:00:00.000000001Z"),
            )
            .unwrap();
        let now = timestamp("2026-07-28T05:00:01.000000002Z");

        let missing_task = move_task_from_state(
            &state,
            move_request(crate::domain::TaskId::new(), CategoryId::INBOX),
            now,
        )
        .unwrap_err();
        let missing_category =
            move_task_from_state(&state, move_request(task.id(), CategoryId::new()), now)
                .unwrap_err();

        assert_eq!(missing_task.code, CommandErrorCode::TaskNotFound);
        assert_eq!(missing_category.code, CommandErrorCode::CategoryNotFound);
        assert_eq!(
            serde_json::to_value(missing_task).unwrap()["code"],
            "task_not_found"
        );
        assert_eq!(
            serde_json::to_value(missing_category).unwrap()["code"],
            "category_not_found"
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn move_task_keeps_persisted_corruption_distinct_from_invalid_input() {
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
                    "2026-07-28T05:00:00.000000001Z"
                ],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = move_task_from_state(
            &state,
            move_request(crate::domain::TaskId::new(), CategoryId::INBOX),
            timestamp("2026-07-28T05:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn set_task_due_date_sets_clears_and_preserves_idempotent_time() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let task = state
            .lock()
            .unwrap()
            .create_task(
                "Task",
                CategoryId::INBOX,
                timestamp("2026-07-28T04:00:00.000000001Z"),
            )
            .unwrap();

        let dated = set_task_due_date_from_state(
            &state,
            due_date_request(task.id(), Some("2026-08-15")),
            timestamp("2026-07-28T04:00:01.000000002Z"),
        )
        .unwrap();
        let idempotent = set_task_due_date_from_state(
            &state,
            due_date_request(task.id(), Some("2026-08-15")),
            timestamp("2026-07-28T04:00:02.000000003Z"),
        )
        .unwrap();
        let clear_request: SetTaskDueDateRequest = serde_json::from_value(serde_json::json!({
            "taskId": task.id().as_uuid().to_string(),
            "dueDate": null
        }))
        .unwrap();
        let cleared = set_task_due_date_from_state(
            &state,
            clear_request,
            timestamp("2026-07-28T04:00:03.000000004Z"),
        )
        .unwrap();

        assert_eq!(
            dated.due_date(),
            Some(NaiveDate::from_ymd_opt(2026, 8, 15).unwrap())
        );
        assert_eq!(
            dated.updated_at(),
            timestamp("2026-07-28T04:00:01.000000002Z")
        );
        assert_eq!(idempotent.updated_at(), dated.updated_at());
        assert_eq!(cleared.due_date(), None);
        assert_eq!(
            cleared.updated_at(),
            timestamp("2026-07-28T04:00:03.000000004Z")
        );
        assert_eq!(
            state.lock().unwrap().task(task.id()).unwrap(),
            Some(cleared)
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn set_task_due_date_rejects_invalid_input_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let task = state
            .lock()
            .unwrap()
            .create_task(
                "Task",
                CategoryId::INBOX,
                timestamp("2026-07-28T04:00:00.000000001Z"),
            )
            .unwrap();

        let invalid_id = set_task_due_date_from_state(
            &state,
            SetTaskDueDateRequest {
                task_id: "not-a-uuid".to_owned(),
                due_date: RequiredOptionalDate::Date("2026-08-15".to_owned()),
            },
            timestamp("2026-07-28T04:00:01.000000002Z"),
        )
        .unwrap_err();
        assert_eq!(invalid_id.code, CommandErrorCode::InvalidInput);
        for invalid_date in ["2026-02-29", "2026-8-05", "+2026-08-05"] {
            let error = set_task_due_date_from_state(
                &state,
                due_date_request(task.id(), Some(invalid_date)),
                timestamp("2026-07-28T04:00:01.000000002Z"),
            )
            .unwrap_err();
            assert_eq!(error.code, CommandErrorCode::InvalidInput);
        }
        assert_eq!(
            state.lock().unwrap().task(task.id()).unwrap().unwrap(),
            task
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn set_task_due_date_requires_the_due_date_field() {
        let result = serde_json::from_value::<SetTaskDueDateRequest>(serde_json::json!({
            "taskId": crate::domain::TaskId::new().as_uuid().to_string()
        }));

        assert!(result.is_err());
    }

    #[test]
    fn set_task_due_date_reports_a_missing_task_with_a_stable_code() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();

        let error = set_task_due_date_from_state(
            &state,
            due_date_request(crate::domain::TaskId::new(), Some("2026-08-15")),
            timestamp("2026-07-28T04:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::TaskNotFound);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn set_task_due_date_keeps_persisted_corruption_distinct_from_invalid_input() {
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
                    "2026-07-28T04:00:00.000000001Z"
                ],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = set_task_due_date_from_state(
            &state,
            due_date_request(crate::domain::TaskId::new(), Some("2026-08-15")),
            timestamp("2026-07-28T04:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_task_normalizes_persists_and_preserves_idempotent_time() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T03:00:00.000000001Z");
        let task = state
            .lock()
            .unwrap()
            .create_task("Old", CategoryId::INBOX, created_at)
            .unwrap();

        let renamed = rename_task_from_state(
            &state,
            rename_request(task.id(), "  New title  "),
            timestamp("2026-07-28T03:00:01.000000002Z"),
        )
        .unwrap();
        let idempotent = rename_task_from_state(
            &state,
            rename_request(task.id(), "New title"),
            timestamp("2026-07-28T03:00:02.000000003Z"),
        )
        .unwrap();

        assert_eq!(renamed.title().as_str(), "New title");
        assert_eq!(
            renamed.updated_at(),
            timestamp("2026-07-28T03:00:01.000000002Z")
        );
        assert_eq!(idempotent.updated_at(), renamed.updated_at());
        assert_eq!(
            state.lock().unwrap().task(task.id()).unwrap(),
            Some(idempotent)
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_task_rejects_invalid_input_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T03:00:00.000000001Z");
        let task = state
            .lock()
            .unwrap()
            .create_task("Original", CategoryId::INBOX, created_at)
            .unwrap();

        let invalid_id = rename_task_from_state(
            &state,
            RenameTaskRequest {
                task_id: "not-a-uuid".to_owned(),
                title: "Valid".to_owned(),
            },
            timestamp("2026-07-28T03:00:01.000000002Z"),
        )
        .unwrap_err();
        let blank_title = rename_task_from_state(
            &state,
            rename_request(task.id(), " \t "),
            timestamp("2026-07-28T03:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(invalid_id.code, CommandErrorCode::InvalidInput);
        assert_eq!(blank_title.code, CommandErrorCode::InvalidInput);
        assert_eq!(
            state.lock().unwrap().task(task.id()).unwrap().unwrap(),
            task
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_task_reports_a_missing_task_with_a_stable_code() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();

        let error = rename_task_from_state(
            &state,
            rename_request(crate::domain::TaskId::new(), "Title"),
            timestamp("2026-07-28T03:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::TaskNotFound);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_task_keeps_persisted_corruption_distinct_from_invalid_input() {
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
                    "2026-07-28T03:00:00.000000001Z"
                ],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = rename_task_from_state(
            &state,
            rename_request(crate::domain::TaskId::new(), "Title"),
            timestamp("2026-07-28T03:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }
    use crate::{
        commands::CommandErrorCode,
        domain::CategoryId,
        storage::{DatabaseState, DATABASE_FILE_NAME},
    };

    #[test]
    fn set_task_status_completes_reopens_and_preserves_idempotent_time() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T02:00:00.000000001Z");
        let task = state
            .lock()
            .unwrap()
            .create_task("Task", CategoryId::INBOX, created_at)
            .unwrap();

        let completed = set_task_status_from_state(
            &state,
            status_request(task.id(), "completed"),
            timestamp("2026-07-28T02:00:01.000000002Z"),
        )
        .unwrap();
        let idempotent = set_task_status_from_state(
            &state,
            status_request(task.id(), "completed"),
            timestamp("2026-07-28T02:00:02.000000003Z"),
        )
        .unwrap();
        let reopened = set_task_status_from_state(
            &state,
            status_request(task.id(), "open"),
            timestamp("2026-07-28T02:00:03.000000004Z"),
        )
        .unwrap();

        assert_eq!(completed.status(), crate::domain::TaskStatus::Completed);
        assert_eq!(
            completed.updated_at(),
            timestamp("2026-07-28T02:00:01.000000002Z")
        );
        assert_eq!(idempotent.updated_at(), completed.updated_at());
        assert_eq!(reopened.status(), crate::domain::TaskStatus::Open);
        assert_eq!(
            reopened.updated_at(),
            timestamp("2026-07-28T02:00:03.000000004Z")
        );
        assert_eq!(
            state.lock().unwrap().task(task.id()).unwrap(),
            Some(reopened)
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn set_task_status_rejects_invalid_input_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T02:00:00.000000001Z");
        let task = state
            .lock()
            .unwrap()
            .create_task("Task", CategoryId::INBOX, created_at)
            .unwrap();

        let invalid_id = set_task_status_from_state(
            &state,
            SetTaskStatusRequest {
                task_id: "not-a-uuid".to_owned(),
                status: "completed".to_owned(),
            },
            timestamp("2026-07-28T02:00:01.000000002Z"),
        )
        .unwrap_err();
        let invalid_status = set_task_status_from_state(
            &state,
            status_request(task.id(), "done"),
            timestamp("2026-07-28T02:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(invalid_id.code, CommandErrorCode::InvalidInput);
        assert_eq!(invalid_status.code, CommandErrorCode::InvalidInput);
        assert_eq!(
            state.lock().unwrap().task(task.id()).unwrap().unwrap(),
            task
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn set_task_status_reports_a_missing_task_with_a_stable_code() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();

        let error = set_task_status_from_state(
            &state,
            status_request(crate::domain::TaskId::new(), "completed"),
            timestamp("2026-07-28T02:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::TaskNotFound);
        assert_eq!(
            serde_json::to_value(error).unwrap()["code"],
            "task_not_found"
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn set_task_status_keeps_persisted_corruption_distinct_from_invalid_input() {
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
                    "2026-07-28T02:00:00.000000001Z"
                ],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = set_task_status_from_state(
            &state,
            status_request(crate::domain::TaskId::new(), "completed"),
            timestamp("2026-07-28T02:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

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

    fn status_request(task_id: crate::domain::TaskId, status: &str) -> SetTaskStatusRequest {
        SetTaskStatusRequest {
            task_id: task_id.as_uuid().to_string(),
            status: status.to_owned(),
        }
    }

    fn rename_request(task_id: crate::domain::TaskId, title: &str) -> RenameTaskRequest {
        RenameTaskRequest {
            task_id: task_id.as_uuid().to_string(),
            title: title.to_owned(),
        }
    }

    fn due_date_request(
        task_id: crate::domain::TaskId,
        due_date: Option<&str>,
    ) -> SetTaskDueDateRequest {
        SetTaskDueDateRequest {
            task_id: task_id.as_uuid().to_string(),
            due_date: match due_date {
                Some(value) => RequiredOptionalDate::Date(value.to_owned()),
                None => RequiredOptionalDate::Null(()),
            },
        }
    }

    fn move_request(task_id: crate::domain::TaskId, category_id: CategoryId) -> MoveTaskRequest {
        MoveTaskRequest {
            task_id: task_id.as_uuid().to_string(),
            category_id: category_id.as_uuid().to_string(),
        }
    }

    fn reorder_request(
        category_id: CategoryId,
        ordered_task_ids: &[crate::domain::TaskId],
    ) -> ReorderTasksRequest {
        ReorderTasksRequest {
            category_id: category_id.as_uuid().to_string(),
            ordered_task_ids: ordered_task_ids
                .iter()
                .map(|id| id.as_uuid().to_string())
                .collect(),
        }
    }

    fn temporary_root() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("smartspace-task-command-{}", Uuid::new_v4()))
    }
}
