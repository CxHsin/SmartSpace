use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::{
    domain::{Category, CategoryId, CategoryName, Task},
    storage::{CategoryDeletionSnapshot, DatabaseRuntimeError, DatabaseState, StorageError},
};

#[derive(Debug, Deserialize)]
pub(crate) struct CreateCategoryRequest {
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenameCategoryRequest {
    category_id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReorderCategoriesRequest {
    ordered_category_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteCategoryRequest {
    category_id: String,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteCategoryResult {
    category_id: CategoryId,
    migrated_task_count: usize,
    categories: Vec<Category>,
    tasks: Vec<Task>,
}

#[tauri::command]
pub(crate) fn create_category(
    database_state: State<'_, DatabaseState>,
    request: CreateCategoryRequest,
) -> Result<Category, CommandError> {
    create_category_from_state(database_state.inner(), request)
}

#[tauri::command]
pub(crate) fn rename_category(
    database_state: State<'_, DatabaseState>,
    request: RenameCategoryRequest,
) -> Result<Category, CommandError> {
    rename_category_from_state(database_state.inner(), request)
}

#[tauri::command]
pub(crate) fn reorder_categories(
    database_state: State<'_, DatabaseState>,
    request: ReorderCategoriesRequest,
) -> Result<Vec<Category>, CommandError> {
    reorder_categories_from_state(database_state.inner(), request)
}

#[tauri::command]
pub(crate) fn delete_category(
    database_state: State<'_, DatabaseState>,
    request: DeleteCategoryRequest,
) -> Result<DeleteCategoryResult, CommandError> {
    delete_category_from_state(database_state.inner(), request, Utc::now())
}

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

fn create_category_from_state(
    database_state: &DatabaseState,
    request: CreateCategoryRequest,
) -> Result<Category, CommandError> {
    let name = CategoryName::new(request.name)
        .map_err(|error| CommandError::invalid_input(error.to_string()))?;
    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .create_category(name.as_str())
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

fn rename_category_from_state(
    database_state: &DatabaseState,
    request: RenameCategoryRequest,
) -> Result<Category, CommandError> {
    let category_id = Uuid::parse_str(&request.category_id)
        .map(CategoryId::from_uuid)
        .map_err(|_| CommandError::invalid_input("categoryId must be a valid UUID"))?;
    let name = CategoryName::new(request.name)
        .map_err(|error| CommandError::invalid_input(error.to_string()))?;

    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .rename_category(category_id, name.as_str())
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)
}

fn reorder_categories_from_state(
    database_state: &DatabaseState,
    request: ReorderCategoriesRequest,
) -> Result<Vec<Category>, CommandError> {
    let ordered_category_ids = request
        .ordered_category_ids
        .iter()
        .map(|value| {
            Uuid::parse_str(value)
                .map(CategoryId::from_uuid)
                .map_err(|_| {
                    CommandError::invalid_input("orderedCategoryIds must contain valid UUIDs")
                })
        })
        .collect::<Result<Vec<_>, _>>()?;

    let mut database = database_state.lock().map_err(CommandError::from)?;
    database
        .reorder_categories(&ordered_category_ids)
        .map_err(|error| match error {
            StorageError::InvalidCategoryOrder => CommandError::invalid_input(error.to_string()),
            error => CommandError::from(DatabaseRuntimeError::from(error)),
        })
}

fn delete_category_from_state(
    database_state: &DatabaseState,
    request: DeleteCategoryRequest,
    now: DateTime<Utc>,
) -> Result<DeleteCategoryResult, CommandError> {
    let category_id = Uuid::parse_str(&request.category_id)
        .map(CategoryId::from_uuid)
        .map_err(|_| CommandError::invalid_input("categoryId must be a valid UUID"))?;

    let mut database = database_state.lock().map_err(CommandError::from)?;
    let CategoryDeletionSnapshot {
        migrated_task_count,
        categories,
        tasks,
    } = database
        .delete_category(category_id, now)
        .map_err(DatabaseRuntimeError::from)
        .map_err(CommandError::from)?;
    Ok(DeleteCategoryResult {
        category_id,
        migrated_task_count,
        categories,
        tasks,
    })
}

#[cfg(test)]
mod tests {
    use std::{fs, sync::Arc, thread};

    use chrono::{DateTime, Utc};
    use rusqlite::Connection;
    use uuid::Uuid;

    use super::{
        create_category_from_state, delete_category_from_state, list_categories_from_state,
        rename_category_from_state, reorder_categories_from_state, CreateCategoryRequest,
        DeleteCategoryRequest, RenameCategoryRequest, ReorderCategoriesRequest,
    };

    #[test]
    fn delete_category_migrates_tasks_and_compacts_category_positions() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let created_at = timestamp("2026-07-28T07:00:00.000000001Z");
        let deleted_at = timestamp("2026-07-28T07:00:01.000000002Z");
        let work = state.lock().unwrap().create_category("Work").unwrap();
        let later = state.lock().unwrap().create_category("Later").unwrap();
        let inbox_task = state
            .lock()
            .unwrap()
            .create_task("Inbox", CategoryId::INBOX, created_at)
            .unwrap();
        let first = state
            .lock()
            .unwrap()
            .create_task("First", work.id(), created_at)
            .unwrap();
        let second = state
            .lock()
            .unwrap()
            .create_task("Second", work.id(), created_at)
            .unwrap();

        let result =
            delete_category_from_state(&state, delete_request(work.id()), deleted_at).unwrap();

        assert_eq!(result.category_id, work.id());
        assert_eq!(result.migrated_task_count, 2);
        assert_eq!(
            result
                .categories
                .iter()
                .map(|category| category.id())
                .collect::<Vec<_>>(),
            vec![CategoryId::INBOX, later.id()]
        );
        assert_eq!(
            result
                .tasks
                .iter()
                .map(|task| task.id())
                .collect::<Vec<_>>(),
            vec![inbox_task.id(), first.id(), second.id()]
        );
        assert_eq!(result.tasks[1].updated_at(), deleted_at);
        assert_eq!(result.tasks[2].updated_at(), deleted_at);
        let serialized = serde_json::to_value(&result).unwrap();
        assert_eq!(serialized["categoryId"], work.id().as_uuid().to_string());
        assert_eq!(serialized["migratedTaskCount"], 2);
        assert_eq!(serialized["categories"].as_array().unwrap().len(), 2);
        assert_eq!(serialized["tasks"].as_array().unwrap().len(), 3);
        let inbox_tasks = state
            .lock()
            .unwrap()
            .tasks_in_category(CategoryId::INBOX)
            .unwrap();
        assert_eq!(
            inbox_tasks.iter().map(|task| task.id()).collect::<Vec<_>>(),
            vec![inbox_task.id(), first.id(), second.id()]
        );
        assert_eq!(inbox_tasks[1].updated_at(), deleted_at);
        assert_eq!(inbox_tasks[2].updated_at(), deleted_at);
        assert_eq!(state.lock().unwrap().category(work.id()).unwrap(), None);
        assert_eq!(
            state
                .lock()
                .unwrap()
                .category(later.id())
                .unwrap()
                .unwrap()
                .position(),
            1
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delete_category_reports_zero_migrations_for_an_empty_category() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let category = state.lock().unwrap().create_category("Empty").unwrap();

        let result = delete_category_from_state(
            &state,
            delete_request(category.id()),
            timestamp("2026-07-28T07:00:01.000000002Z"),
        )
        .unwrap();

        assert_eq!(result.migrated_task_count, 0);
        assert_eq!(state.lock().unwrap().category(category.id()).unwrap(), None);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delete_category_rejects_invalid_ids_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let category = state.lock().unwrap().create_category("Work").unwrap();
        let original = state.lock().unwrap().list_categories().unwrap();

        let error = delete_category_from_state(
            &state,
            DeleteCategoryRequest {
                category_id: "not-a-uuid".to_owned(),
            },
            timestamp("2026-07-28T07:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::InvalidInput);
        assert_eq!(
            state.lock().unwrap().category(category.id()).unwrap(),
            Some(category)
        );
        assert_eq!(state.lock().unwrap().list_categories().unwrap(), original);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delete_category_reports_protected_and_missing_categories_with_stable_codes() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let original = state.lock().unwrap().list_categories().unwrap();
        let now = timestamp("2026-07-28T07:00:01.000000002Z");

        let protected =
            delete_category_from_state(&state, delete_request(CategoryId::INBOX), now).unwrap_err();
        let missing =
            delete_category_from_state(&state, delete_request(CategoryId::new()), now).unwrap_err();

        assert_eq!(protected.code, CommandErrorCode::CannotDeleteInbox);
        assert_eq!(missing.code, CommandErrorCode::CategoryNotFound);
        assert_eq!(
            serde_json::to_value(protected).unwrap()["code"],
            "cannot_delete_inbox"
        );
        assert_eq!(
            serde_json::to_value(missing).unwrap()["code"],
            "category_not_found"
        );
        assert_eq!(state.lock().unwrap().list_categories().unwrap(), original);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delete_category_keeps_persisted_corruption_distinct_from_invalid_input() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let category = state.lock().unwrap().create_category("Work").unwrap();
        let task = state
            .lock()
            .unwrap()
            .create_task(
                "Task",
                category.id(),
                timestamp("2026-07-28T07:00:00.000000001Z"),
            )
            .unwrap();
        drop(state);
        let connection = Connection::open(root.join(DATABASE_FILE_NAME)).unwrap();
        connection
            .execute(
                "UPDATE tasks SET title = '  Broken  ' WHERE id = ?1",
                [task.id().as_uuid().to_string()],
            )
            .unwrap();
        drop(connection);
        let state = DatabaseState::initialize(&root).unwrap();

        let error = delete_category_from_state(
            &state,
            delete_request(category.id()),
            timestamp("2026-07-28T07:00:01.000000002Z"),
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        let connection = Connection::open(root.join(DATABASE_FILE_NAME)).unwrap();
        let category_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE id = ?1",
                [category.id().as_uuid().to_string()],
                |row| row.get(0),
            )
            .unwrap();
        let persisted_task: (String, String, i64) = connection
            .query_row(
                "SELECT title, category_id, position FROM tasks WHERE id = ?1",
                [task.id().as_uuid().to_string()],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(category_count, 1);
        assert_eq!(persisted_task.0, "  Broken  ");
        assert_eq!(persisted_task.1, category.id().as_uuid().to_string());
        assert_eq!(persisted_task.2, 0);
        drop(connection);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reorder_categories_persists_the_complete_requested_order() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let work = state.lock().unwrap().create_category("Work").unwrap();
        let personal = state.lock().unwrap().create_category("Personal").unwrap();

        let reordered = reorder_categories_from_state(
            &state,
            reorder_request(&[personal.id(), CategoryId::INBOX, work.id()]),
        )
        .unwrap();

        assert_eq!(
            reordered
                .iter()
                .map(|category| category.id())
                .collect::<Vec<_>>(),
            vec![personal.id(), CategoryId::INBOX, work.id()]
        );
        assert_eq!(
            reordered
                .iter()
                .map(|category| category.position())
                .collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
        assert_eq!(reordered[1].kind(), CategoryKind::Inbox);
        assert_eq!(state.lock().unwrap().list_categories().unwrap(), reordered);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reorder_categories_is_idempotent_for_the_current_order() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let work = state.lock().unwrap().create_category("Work").unwrap();
        let expected = state.lock().unwrap().list_categories().unwrap();

        let unchanged =
            reorder_categories_from_state(&state, reorder_request(&[CategoryId::INBOX, work.id()]))
                .unwrap();

        assert_eq!(unchanged, expected);
        assert_eq!(state.lock().unwrap().list_categories().unwrap(), expected);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reorder_categories_rejects_invalid_or_incomplete_orders_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let work = state.lock().unwrap().create_category("Work").unwrap();
        let original = state.lock().unwrap().list_categories().unwrap();

        let invalid_uuid = reorder_categories_from_state(
            &state,
            ReorderCategoriesRequest {
                ordered_category_ids: vec!["not-a-uuid".to_owned()],
            },
        )
        .unwrap_err();
        assert_eq!(invalid_uuid.code, CommandErrorCode::InvalidInput);

        for ids in [
            vec![CategoryId::INBOX],
            vec![CategoryId::INBOX, CategoryId::INBOX],
            vec![CategoryId::INBOX, work.id(), CategoryId::new()],
        ] {
            let error = reorder_categories_from_state(&state, reorder_request(&ids)).unwrap_err();
            assert_eq!(error.code, CommandErrorCode::InvalidInput);
            assert_eq!(
                serde_json::to_value(error).unwrap()["code"],
                "invalid_input"
            );
        }
        assert_eq!(state.lock().unwrap().list_categories().unwrap(), original);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reorder_categories_keeps_persisted_corruption_distinct_from_invalid_input() {
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

        let error = reorder_categories_from_state(&state, reorder_request(&[CategoryId::INBOX]))
            .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }
    use crate::{
        commands::CommandErrorCode,
        domain::{CategoryId, CategoryKind},
        storage::{DatabaseState, DATABASE_FILE_NAME},
    };

    #[test]
    fn rename_category_normalizes_and_persists_the_name() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let category = state.lock().unwrap().create_category("Old").unwrap();

        let renamed =
            rename_category_from_state(&state, rename_request(category.id(), "  New name  "))
                .unwrap();
        let idempotent =
            rename_category_from_state(&state, rename_request(category.id(), "New name")).unwrap();

        assert_eq!(renamed.name().as_str(), "New name");
        assert_eq!(idempotent, renamed);
        assert_eq!(
            state.lock().unwrap().category(category.id()).unwrap(),
            Some(renamed)
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_category_preserves_the_inbox_identity_and_kind() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();

        let renamed =
            rename_category_from_state(&state, rename_request(CategoryId::INBOX, "Unsorted"))
                .unwrap();

        assert_eq!(renamed.id(), CategoryId::INBOX);
        assert_eq!(renamed.kind(), CategoryKind::Inbox);
        assert_eq!(renamed.name().as_str(), "Unsorted");
        assert_eq!(
            state.lock().unwrap().category(CategoryId::INBOX).unwrap(),
            Some(renamed)
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_category_rejects_invalid_input_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let category = state.lock().unwrap().create_category("Original").unwrap();

        let invalid_id = rename_category_from_state(
            &state,
            RenameCategoryRequest {
                category_id: "not-a-uuid".to_owned(),
                name: "Valid".to_owned(),
            },
        )
        .unwrap_err();
        let blank_name =
            rename_category_from_state(&state, rename_request(category.id(), " \t ")).unwrap_err();

        assert_eq!(invalid_id.code, CommandErrorCode::InvalidInput);
        assert_eq!(blank_name.code, CommandErrorCode::InvalidInput);
        assert_eq!(
            state.lock().unwrap().category(category.id()).unwrap(),
            Some(category)
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_category_reports_duplicate_and_missing_categories_with_stable_codes() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        let first = state.lock().unwrap().create_category("École").unwrap();
        let second = state.lock().unwrap().create_category("Personal").unwrap();

        let duplicate =
            rename_category_from_state(&state, rename_request(second.id(), "éCOLE")).unwrap_err();
        let missing =
            rename_category_from_state(&state, rename_request(CategoryId::new(), "Missing"))
                .unwrap_err();

        assert_eq!(duplicate.code, CommandErrorCode::DuplicateCategoryName);
        assert_eq!(missing.code, CommandErrorCode::CategoryNotFound);
        assert_eq!(
            serde_json::to_value(duplicate).unwrap()["code"],
            "duplicate_category_name"
        );
        assert_eq!(
            serde_json::to_value(missing).unwrap()["code"],
            "category_not_found"
        );
        assert_eq!(
            state.lock().unwrap().category(first.id()).unwrap(),
            Some(first)
        );
        assert_eq!(
            state.lock().unwrap().category(second.id()).unwrap(),
            Some(second)
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_category_keeps_persisted_corruption_distinct_from_invalid_input() {
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

        let error = rename_category_from_state(&state, rename_request(CategoryId::INBOX, "Valid"))
            .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_category_normalizes_and_persists_the_name() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();

        let created = create_category_from_state(
            &state,
            CreateCategoryRequest {
                name: "  Work  ".to_owned(),
            },
        )
        .unwrap();

        assert_eq!(created.name().as_str(), "Work");
        assert_eq!(created.position(), 1);
        assert_eq!(
            state.lock().unwrap().category(created.id()).unwrap(),
            Some(created)
        );

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_category_rejects_a_blank_name_without_writing() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();

        let error = create_category_from_state(
            &state,
            CreateCategoryRequest {
                name: " \t ".to_owned(),
            },
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::InvalidInput);
        assert_eq!(state.lock().unwrap().list_categories().unwrap().len(), 1);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_category_reports_unicode_duplicates_with_a_stable_code() {
        let root = temporary_root();
        let state = DatabaseState::initialize(&root).unwrap();
        create_category_from_state(
            &state,
            CreateCategoryRequest {
                name: "École".to_owned(),
            },
        )
        .unwrap();

        let error = create_category_from_state(
            &state,
            CreateCategoryRequest {
                name: "éCOLE".to_owned(),
            },
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DuplicateCategoryName);
        assert_eq!(
            serde_json::to_value(error).unwrap()["code"],
            "duplicate_category_name"
        );
        assert_eq!(state.lock().unwrap().list_categories().unwrap().len(), 2);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_category_keeps_persisted_corruption_distinct_from_invalid_input() {
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

        let error = create_category_from_state(
            &state,
            CreateCategoryRequest {
                name: "Valid".to_owned(),
            },
        )
        .unwrap_err();

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);

        drop(state);
        fs::remove_dir_all(root).unwrap();
    }

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

    fn rename_request(category_id: CategoryId, name: &str) -> RenameCategoryRequest {
        RenameCategoryRequest {
            category_id: category_id.as_uuid().to_string(),
            name: name.to_owned(),
        }
    }

    fn reorder_request(category_ids: &[CategoryId]) -> ReorderCategoriesRequest {
        ReorderCategoriesRequest {
            ordered_category_ids: category_ids
                .iter()
                .map(|id| id.as_uuid().to_string())
                .collect(),
        }
    }

    fn delete_request(category_id: CategoryId) -> DeleteCategoryRequest {
        DeleteCategoryRequest {
            category_id: category_id.as_uuid().to_string(),
        }
    }

    fn timestamp(value: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(value)
            .unwrap()
            .with_timezone(&Utc)
    }
}
