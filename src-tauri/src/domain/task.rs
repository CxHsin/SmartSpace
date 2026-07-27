use chrono::{DateTime, NaiveDate, Utc};
use serde::{de::Error as _, Deserialize, Deserializer, Serialize};

use super::{CategoryId, DomainError, TaskId};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct TaskTitle(String);

impl TaskTitle {
    pub fn new(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into();
        let value = value.trim();
        if value.is_empty() {
            return Err(DomainError::EmptyTaskTitle);
        }

        Ok(Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for TaskTitle {
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
pub enum TaskStatus {
    Open,
    Completed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    id: TaskId,
    title: TaskTitle,
    status: TaskStatus,
    due_date: Option<NaiveDate>,
    category_id: CategoryId,
    position: i64,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl Task {
    pub fn new(
        title: impl Into<String>,
        category_id: CategoryId,
        position: i64,
        now: DateTime<Utc>,
    ) -> Result<Self, DomainError> {
        Self::restore(
            TaskId::new(),
            TaskTitle::new(title)?,
            TaskStatus::Open,
            None,
            category_id,
            position,
            now,
            now,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn restore(
        id: TaskId,
        title: TaskTitle,
        status: TaskStatus,
        due_date: Option<NaiveDate>,
        category_id: CategoryId,
        position: i64,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Result<Self, DomainError> {
        if updated_at < created_at {
            return Err(DomainError::UpdatedBeforeCreated);
        }

        Ok(Self {
            id,
            title,
            status,
            due_date,
            category_id,
            position,
            created_at,
            updated_at,
        })
    }

    pub const fn id(&self) -> TaskId {
        self.id
    }

    pub fn title(&self) -> &TaskTitle {
        &self.title
    }

    pub const fn status(&self) -> TaskStatus {
        self.status
    }

    pub const fn due_date(&self) -> Option<NaiveDate> {
        self.due_date
    }

    pub const fn category_id(&self) -> CategoryId {
        self.category_id
    }

    pub const fn position(&self) -> i64 {
        self.position
    }

    pub const fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub const fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    pub fn rename(
        &mut self,
        title: impl Into<String>,
        now: DateTime<Utc>,
    ) -> Result<bool, DomainError> {
        let title = TaskTitle::new(title)?;
        if self.title == title {
            return Ok(false);
        }
        self.title = title;
        self.touch(now);
        Ok(true)
    }

    pub fn complete(&mut self, now: DateTime<Utc>) -> bool {
        self.set_status(TaskStatus::Completed, now)
    }

    pub fn reopen(&mut self, now: DateTime<Utc>) -> bool {
        self.set_status(TaskStatus::Open, now)
    }

    pub fn set_due_date(&mut self, due_date: Option<NaiveDate>, now: DateTime<Utc>) -> bool {
        if self.due_date == due_date {
            return false;
        }
        self.due_date = due_date;
        self.touch(now);
        true
    }

    pub fn move_to_category(&mut self, category_id: CategoryId, now: DateTime<Utc>) -> bool {
        if self.category_id == category_id {
            return false;
        }
        self.category_id = category_id;
        self.touch(now);
        true
    }

    pub fn reposition(&mut self, position: i64, now: DateTime<Utc>) -> bool {
        if self.position == position {
            return false;
        }
        self.position = position;
        self.touch(now);
        true
    }

    fn set_status(&mut self, status: TaskStatus, now: DateTime<Utc>) -> bool {
        if self.status == status {
            return false;
        }
        self.status = status;
        self.touch(now);
        true
    }

    fn touch(&mut self, now: DateTime<Utc>) {
        self.updated_at = self.updated_at.max(now);
    }
}

impl<'de> Deserialize<'de> for Task {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct TaskData {
            id: TaskId,
            title: TaskTitle,
            status: TaskStatus,
            due_date: Option<NaiveDate>,
            category_id: CategoryId,
            position: i64,
            created_at: DateTime<Utc>,
            updated_at: DateTime<Utc>,
        }

        let data = TaskData::deserialize(deserializer)?;
        Self::restore(
            data.id,
            data.title,
            data.status,
            data.due_date,
            data.category_id,
            data.position,
            data.created_at,
            data.updated_at,
        )
        .map_err(D::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, NaiveDate, TimeZone, Utc};

    use super::{Task, TaskStatus, TaskTitle};
    use crate::domain::{CategoryId, DomainError};

    fn now() -> chrono::DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 7, 27, 12, 0, 0).unwrap()
    }

    #[test]
    fn task_titles_are_trimmed_and_blank_titles_are_rejected() {
        assert_eq!(TaskTitle::new("  Ship it  ").unwrap().as_str(), "Ship it");
        assert_eq!(
            TaskTitle::new(" \n ").unwrap_err(),
            DomainError::EmptyTaskTitle
        );
    }

    #[test]
    fn new_tasks_start_open_in_exactly_one_category() {
        let category_id = CategoryId::new();
        let task = Task::new("Write tests", category_id, 4, now()).unwrap();

        assert_eq!(task.status(), TaskStatus::Open);
        assert_eq!(task.category_id(), category_id);
        assert_eq!(task.position(), 4);
        assert_eq!(task.created_at(), now());
        assert_eq!(task.updated_at(), now());
    }

    #[test]
    fn task_mutations_update_time_only_when_state_changes() {
        let category_id = CategoryId::new();
        let next_category_id = CategoryId::new();
        let mut task = Task::new("Write tests", category_id, 0, now()).unwrap();
        let later = now() + Duration::minutes(5);
        let due_date = NaiveDate::from_ymd_opt(2026, 7, 31).unwrap();

        assert!(task.complete(later));
        assert!(!task.complete(later + Duration::minutes(1)));
        assert!(task.reopen(later + Duration::minutes(2)));
        assert!(task.set_due_date(Some(due_date), later + Duration::minutes(3)));
        assert!(task.move_to_category(next_category_id, later + Duration::minutes(4)));
        assert!(task.reposition(7, later + Duration::minutes(5)));
        assert!(task
            .rename("Reviewed tests", later + Duration::minutes(6))
            .unwrap());

        assert_eq!(task.status(), TaskStatus::Open);
        assert_eq!(task.due_date(), Some(due_date));
        assert_eq!(task.category_id(), next_category_id);
        assert_eq!(task.position(), 7);
        assert_eq!(task.title().as_str(), "Reviewed tests");
        assert_eq!(task.updated_at(), later + Duration::minutes(6));
    }

    #[test]
    fn restore_rejects_backwards_timestamps() {
        let created_at = now();
        let updated_at = created_at - Duration::seconds(1);
        let valid = Task::new("Write tests", CategoryId::INBOX, 0, now()).unwrap();

        assert_eq!(
            Task::restore(
                valid.id(),
                valid.title().clone(),
                valid.status(),
                valid.due_date(),
                valid.category_id(),
                valid.position(),
                created_at,
                updated_at,
            )
            .unwrap_err(),
            DomainError::UpdatedBeforeCreated
        );
    }

    #[test]
    fn task_mutations_do_not_move_updated_at_backwards() {
        let mut task = Task::new("Write tests", CategoryId::INBOX, 0, now()).unwrap();

        assert!(task.complete(now() - Duration::minutes(1)));
        assert_eq!(task.updated_at(), now());
    }

    #[test]
    fn invalid_tasks_cannot_enter_through_json() {
        let task = Task::new("Write tests", CategoryId::INBOX, 0, now()).unwrap();
        let mut value = serde_json::to_value(task).unwrap();
        value["title"] = serde_json::Value::String("  ".to_owned());

        assert!(serde_json::from_value::<Task>(value).is_err());
    }

    #[test]
    fn tasks_round_trip_through_json() {
        let task = Task::new("Write tests", CategoryId::INBOX, 0, now()).unwrap();
        let json = serde_json::to_string(&task).unwrap();

        assert_eq!(serde_json::from_str::<Task>(&json).unwrap(), task);
    }
}
