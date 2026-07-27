use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::{
    domain::{Category, CategoryId, CategoryName},
    storage::{DatabaseRuntimeError, DatabaseState, StorageError},
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

#[cfg(test)]
mod tests {
    use std::{fs, sync::Arc, thread};

    use rusqlite::Connection;
    use uuid::Uuid;

    use super::{
        create_category_from_state, list_categories_from_state, rename_category_from_state,
        reorder_categories_from_state, CreateCategoryRequest, RenameCategoryRequest,
        ReorderCategoriesRequest,
    };

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
}
