use serde::Serialize;

use crate::{
    domain::DomainError,
    storage::{DatabaseRuntimeError, StorageError},
};

pub(crate) mod applications;
pub(crate) mod categories;
pub(crate) mod tasks;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum CommandErrorCode {
    InvalidInput,
    CategoryNotFound,
    TaskNotFound,
    ApplicationNotFound,
    DuplicateCategoryName,
    CannotDeleteInbox,
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
            DatabaseRuntimeError::Storage(StorageError::Domain(DomainError::CannotDeleteInbox)) => {
                CommandErrorCode::CannotDeleteInbox
            }
            DatabaseRuntimeError::Storage(
                StorageError::Domain(_)
                | StorageError::InvalidUuid(_)
                | StorageError::InvalidCategoryKind(_)
                | StorageError::InvalidTimestamp(_)
                | StorageError::CorruptCategoryStore { .. }
                | StorageError::InvalidTaskStatus(_)
                | StorageError::InvalidTaskDate(_)
                | StorageError::CorruptTaskStore { .. }
                | StorageError::CorruptApplicationStore { .. },
            ) => CommandErrorCode::DataCorrupt,
            DatabaseRuntimeError::Storage(StorageError::CategoryNotFound { .. }) => {
                CommandErrorCode::CategoryNotFound
            }
            DatabaseRuntimeError::Storage(StorageError::TaskNotFound { .. }) => {
                CommandErrorCode::TaskNotFound
            }
            DatabaseRuntimeError::Storage(StorageError::ApplicationNotFound { .. }) => {
                CommandErrorCode::ApplicationNotFound
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

#[cfg(test)]
mod tests {
    use super::{CommandError, CommandErrorCode};
    use crate::domain::ApplicationId;
    use crate::storage::{DatabaseRuntimeError, StorageError};

    #[test]
    fn corrupt_application_storage_maps_to_the_shared_data_corrupt_code() {
        let error = CommandError::from(DatabaseRuntimeError::Storage(
            StorageError::CorruptApplicationStore {
                reason: "test corruption",
            },
        ));

        assert_eq!(error.code, CommandErrorCode::DataCorrupt);
        assert_eq!(serde_json::to_value(error).unwrap()["code"], "data_corrupt");
    }

    #[test]
    fn missing_application_maps_to_the_shared_application_not_found_code() {
        let error = CommandError::from(DatabaseRuntimeError::Storage(
            StorageError::ApplicationNotFound {
                id: ApplicationId::new(),
            },
        ));

        assert_eq!(error.code, CommandErrorCode::ApplicationNotFound);
        assert_eq!(
            serde_json::to_value(error).unwrap()["code"],
            "application_not_found"
        );
    }
}
