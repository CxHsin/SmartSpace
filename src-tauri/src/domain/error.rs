use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum DomainError {
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
