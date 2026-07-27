use serde::Serialize;

use crate::storage::{DatabaseRuntimeError, StorageError};

pub(crate) mod categories;
pub(crate) mod tasks;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum CommandErrorCode {
    InvalidInput,
    CategoryNotFound,
    TaskNotFound,
    DuplicateCategoryName,
    DatabaseUnavailable,
    DataCorrupt,
    DatabaseOperationFailed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommandError {
    code: CommandErrorCode,
    message: String,
}

impl From<DatabaseRuntimeError> for CommandError {
    fn from(error: DatabaseRuntimeError) -> Self {
        let code = match &error {
            DatabaseRuntimeError::CreateDataDirectory { .. }
            | DatabaseRuntimeError::LockPoisoned => CommandErrorCode::DatabaseUnavailable,
            DatabaseRuntimeError::Storage(
                StorageError::Domain(_)
                | StorageError::InvalidUuid(_)
                | StorageError::InvalidCategoryKind(_)
                | StorageError::InvalidTimestamp(_)
                | StorageError::CorruptCategoryStore { .. }
                | StorageError::InvalidTaskStatus(_)
                | StorageError::InvalidTaskDate(_)
                | StorageError::CorruptTaskStore { .. },
            ) => CommandErrorCode::DataCorrupt,
            DatabaseRuntimeError::Storage(StorageError::CategoryNotFound { .. }) => {
                CommandErrorCode::CategoryNotFound
            }
            DatabaseRuntimeError::Storage(StorageError::TaskNotFound { .. }) => {
                CommandErrorCode::TaskNotFound
            }
            DatabaseRuntimeError::Storage(StorageError::DuplicateCategoryName) => {
                CommandErrorCode::DuplicateCategoryName
            }
            DatabaseRuntimeError::Storage(_) => CommandErrorCode::DatabaseOperationFailed,
        };

        Self {
            code,
            message: error.to_string(),
        }
    }
}

impl CommandError {
    fn invalid_input(message: impl Into<String>) -> Self {
        Self {
            code: CommandErrorCode::InvalidInput,
            message: message.into(),
        }
    }
}
