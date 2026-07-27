use serde::{de::Error as _, Deserialize, Deserializer, Serialize};

use super::{CategoryId, DomainError};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct CategoryName(String);

impl CategoryName {
    pub fn new(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into();
        let value = value.trim();
        if value.is_empty() {
            return Err(DomainError::EmptyCategoryName);
        }

        Ok(Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for CategoryName {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(D::Error::custom)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CategoryKind {
    Inbox,
    User,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    id: CategoryId,
    name: CategoryName,
    position: i64,
    kind: CategoryKind,
}

impl Category {
    pub fn inbox() -> Self {
        Self {
            id: CategoryId::INBOX,
            name: CategoryName("Inbox".to_owned()),
            position: 0,
            kind: CategoryKind::Inbox,
        }
    }

    pub fn new_user(name: impl Into<String>, position: i64) -> Result<Self, DomainError> {
        Self::restore(
            CategoryId::new(),
            CategoryName::new(name)?,
            position,
            CategoryKind::User,
        )
    }

    pub fn restore(
        id: CategoryId,
        name: CategoryName,
        position: i64,
        kind: CategoryKind,
    ) -> Result<Self, DomainError> {
        match (id, kind) {
            (CategoryId::INBOX, CategoryKind::Inbox) => {}
            (CategoryId::INBOX, CategoryKind::User) => return Err(DomainError::ReservedInboxId),
            (_, CategoryKind::Inbox) => return Err(DomainError::InvalidInboxId),
            (_, CategoryKind::User) => {}
        }

        Ok(Self {
            id,
            name,
            position,
            kind,
        })
    }

    pub const fn id(&self) -> CategoryId {
        self.id
    }

    pub fn name(&self) -> &CategoryName {
        &self.name
    }

    pub const fn position(&self) -> i64 {
        self.position
    }

    pub const fn kind(&self) -> CategoryKind {
        self.kind
    }

    pub fn rename(&mut self, name: impl Into<String>) -> Result<(), DomainError> {
        self.name = CategoryName::new(name)?;
        Ok(())
    }

    pub fn reposition(&mut self, position: i64) {
        self.position = position;
    }

    pub fn ensure_deletable(&self) -> Result<(), DomainError> {
        if self.kind == CategoryKind::Inbox {
            return Err(DomainError::CannotDeleteInbox);
        }
        Ok(())
    }
}

impl<'de> Deserialize<'de> for Category {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct CategoryData {
            id: CategoryId,
            name: CategoryName,
            position: i64,
            kind: CategoryKind,
        }

        let data = CategoryData::deserialize(deserializer)?;
        Self::restore(data.id, data.name, data.position, data.kind).map_err(D::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{Category, CategoryKind, CategoryName};
    use crate::domain::{CategoryId, DomainError};

    #[test]
    fn category_names_are_trimmed_and_blank_names_are_rejected() {
        assert_eq!(CategoryName::new("  Work  ").unwrap().as_str(), "Work");
        assert_eq!(
            CategoryName::new(" \t ").unwrap_err(),
            DomainError::EmptyCategoryName
        );
    }

    #[test]
    fn inbox_uses_the_reserved_id_and_cannot_be_deleted() {
        let inbox = Category::inbox();

        assert_eq!(inbox.id(), CategoryId::INBOX);
        assert_eq!(inbox.kind(), CategoryKind::Inbox);
        assert_eq!(
            inbox.ensure_deletable().unwrap_err(),
            DomainError::CannotDeleteInbox
        );
    }

    #[test]
    fn restore_rejects_mismatched_inbox_identity() {
        let name = CategoryName::new("Inbox").unwrap();
        assert_eq!(
            Category::restore(CategoryId::new(), name.clone(), 0, CategoryKind::Inbox).unwrap_err(),
            DomainError::InvalidInboxId
        );
        assert_eq!(
            Category::restore(CategoryId::INBOX, name, 0, CategoryKind::User).unwrap_err(),
            DomainError::ReservedInboxId
        );
    }

    #[test]
    fn invalid_categories_cannot_enter_through_json() {
        let id = Uuid::new_v4();
        let json = format!(r#"{{"id":"{id}","name":"Inbox","position":0,"kind":"inbox"}}"#);

        assert!(serde_json::from_str::<Category>(&json).is_err());
    }

    #[test]
    fn user_categories_round_trip_through_json() {
        let category = Category::new_user("Work", 3).unwrap();
        let json = serde_json::to_string(&category).unwrap();

        assert_eq!(serde_json::from_str::<Category>(&json).unwrap(), category);
    }
}
