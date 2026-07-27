use serde::Serialize;

use crate::storage::{DatabaseRuntimeError, StorageError};

pub(crate) mod categories;
pub(crate) mod tasks;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum CommandErrorCode {
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
            DatabaseRuntimeError::Storage(_) => CommandErrorCode::DatabaseOperationFailed,
        };

        Self {
            code,
            message: error.to_string(),
        }
    }
}
