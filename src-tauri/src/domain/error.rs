use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum DomainError {
    #[error("application display name cannot be empty")]
    EmptyApplicationDisplayName,
    #[error("application executable path cannot be empty")]
    EmptyApplicationExecutablePath,
    #[error("application executable path is invalid")]
    InvalidApplicationExecutablePath,
    #[error("application executable path must be absolute")]
    ApplicationExecutablePathNotAbsolute,
    #[error("application executable path must use the .exe extension")]
    ApplicationExecutablePathNotExe,
    #[error("application icon cache key cannot be empty")]
    EmptyApplicationIconCacheKey,
    #[error("application position cannot be negative")]
    NegativeApplicationPosition,
    #[error("task title cannot be empty")]
    EmptyTaskTitle,
    #[error("category name cannot be empty")]
    EmptyCategoryName,
    #[error("the inbox category cannot be deleted")]
    CannotDeleteInbox,
    #[error("the inbox category must use its reserved identifier")]
    InvalidInboxId,
    #[error("a user category cannot use the reserved inbox identifier")]
    ReservedInboxId,
    #[error("updated_at cannot be earlier than created_at")]
    UpdatedBeforeCreated,
}
