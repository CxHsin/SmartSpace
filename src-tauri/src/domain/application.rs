use std::path::Path;

use serde::{de::Error as _, Deserialize, Deserializer, Serialize};

use super::{ApplicationId, DomainError};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct ApplicationDisplayName(String);

impl ApplicationDisplayName {
    pub fn new(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into();
        let value = value.trim();
        if value.is_empty() {
            return Err(DomainError::EmptyApplicationDisplayName);
        }

        Ok(Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for ApplicationDisplayName {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(D::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct ApplicationExecutablePath(String);

impl ApplicationExecutablePath {
    pub fn new(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into();
        if value.trim().is_empty() {
            return Err(DomainError::EmptyApplicationExecutablePath);
        }
        if value.contains('\0') {
            return Err(DomainError::InvalidApplicationExecutablePath);
        }

        let path = Path::new(&value);
        if !path.is_absolute() {
            return Err(DomainError::ApplicationExecutablePathNotAbsolute);
        }
        let is_executable = path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"));
        if !is_executable {
            return Err(DomainError::ApplicationExecutablePathNotExe);
        }

        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for ApplicationExecutablePath {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(D::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct ApplicationIconCacheKey(String);

impl ApplicationIconCacheKey {
    pub fn new(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into();
        let value = value.trim();
        if value.is_empty() {
            return Err(DomainError::EmptyApplicationIconCacheKey);
        }

        Ok(Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for ApplicationIconCacheKey {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(D::Error::custom)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct ApplicationPosition(i64);

impl ApplicationPosition {
    pub fn new(value: i64) -> Result<Self, DomainError> {
        if value < 0 {
            return Err(DomainError::NegativeApplicationPosition);
        }
        Ok(Self(value))
    }

    pub const fn get(self) -> i64 {
        self.0
    }
}

impl<'de> Deserialize<'de> for ApplicationPosition {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = i64::deserialize(deserializer)?;
        Self::new(value).map_err(D::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationConfig {
    id: ApplicationId,
    display_name: ApplicationDisplayName,
    executable_path: ApplicationExecutablePath,
    icon_cache_key: Option<ApplicationIconCacheKey>,
    position: ApplicationPosition,
}

impl ApplicationConfig {
    pub fn new(
        display_name: impl Into<String>,
        executable_path: impl Into<String>,
        icon_cache_key: Option<String>,
        position: i64,
    ) -> Result<Self, DomainError> {
        let icon_cache_key = icon_cache_key
            .map(ApplicationIconCacheKey::new)
            .transpose()?;
        Self::restore(
            ApplicationId::new(),
            ApplicationDisplayName::new(display_name)?,
            ApplicationExecutablePath::new(executable_path)?,
            icon_cache_key,
            ApplicationPosition::new(position)?,
        )
    }

    pub fn restore(
        id: ApplicationId,
        display_name: ApplicationDisplayName,
        executable_path: ApplicationExecutablePath,
        icon_cache_key: Option<ApplicationIconCacheKey>,
        position: ApplicationPosition,
    ) -> Result<Self, DomainError> {
        Ok(Self {
            id,
            display_name,
            executable_path,
            icon_cache_key,
            position,
        })
    }

    pub const fn id(&self) -> ApplicationId {
        self.id
    }

    pub fn display_name(&self) -> &ApplicationDisplayName {
        &self.display_name
    }

    pub fn executable_path(&self) -> &ApplicationExecutablePath {
        &self.executable_path
    }

    pub fn icon_cache_key(&self) -> Option<&ApplicationIconCacheKey> {
        self.icon_cache_key.as_ref()
    }

    pub const fn position(&self) -> ApplicationPosition {
        self.position
    }
}

impl<'de> Deserialize<'de> for ApplicationConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct ApplicationConfigData {
            id: ApplicationId,
            display_name: ApplicationDisplayName,
            executable_path: ApplicationExecutablePath,
            icon_cache_key: Option<ApplicationIconCacheKey>,
            position: ApplicationPosition,
        }

        let data = ApplicationConfigData::deserialize(deserializer)?;
        Self::restore(
            data.id,
            data.display_name,
            data.executable_path,
            data.icon_cache_key,
            data.position,
        )
        .map_err(D::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ApplicationConfig, ApplicationDisplayName, ApplicationExecutablePath,
        ApplicationIconCacheKey, ApplicationPosition,
    };
    use crate::domain::DomainError;

    #[test]
    fn display_names_and_icon_keys_are_normalized() {
        assert_eq!(
            ApplicationDisplayName::new("  Example Tool  ")
                .unwrap()
                .as_str(),
            "Example Tool"
        );
        assert_eq!(
            ApplicationIconCacheKey::new("  example-icon  ")
                .unwrap()
                .as_str(),
            "example-icon"
        );
        assert_eq!(
            ApplicationDisplayName::new(" \t ").unwrap_err(),
            DomainError::EmptyApplicationDisplayName
        );
        assert_eq!(
            ApplicationIconCacheKey::new(" \n ").unwrap_err(),
            DomainError::EmptyApplicationIconCacheKey
        );
    }

    #[test]
    fn executable_paths_are_syntactically_validated_without_file_access() {
        let path = r"C:\Program Files\Example\Example.EXE";
        assert_eq!(ApplicationExecutablePath::new(path).unwrap().as_str(), path);
        assert_eq!(
            ApplicationExecutablePath::new(" \t ").unwrap_err(),
            DomainError::EmptyApplicationExecutablePath
        );
        assert_eq!(
            ApplicationExecutablePath::new("C:\\Example\0tool.exe").unwrap_err(),
            DomainError::InvalidApplicationExecutablePath
        );
        assert_eq!(
            ApplicationExecutablePath::new("relative\\tool.exe").unwrap_err(),
            DomainError::ApplicationExecutablePathNotAbsolute
        );
        assert_eq!(
            ApplicationExecutablePath::new(r"C:\Example\tool.cmd").unwrap_err(),
            DomainError::ApplicationExecutablePathNotExe
        );
    }

    #[test]
    fn positions_must_be_non_negative() {
        assert_eq!(ApplicationPosition::new(0).unwrap().get(), 0);
        assert_eq!(
            ApplicationPosition::new(-1).unwrap_err(),
            DomainError::NegativeApplicationPosition
        );
    }

    #[test]
    fn new_configs_preserve_the_selected_path_and_optional_icon() {
        let config = ApplicationConfig::new(
            "  Example Tool  ",
            r"C:\Program Files\Example\Example.exe",
            Some("  example-icon  ".to_owned()),
            3,
        )
        .unwrap();

        assert_eq!(config.display_name().as_str(), "Example Tool");
        assert_eq!(
            config.executable_path().as_str(),
            r"C:\Program Files\Example\Example.exe"
        );
        assert_eq!(config.icon_cache_key().unwrap().as_str(), "example-icon");
        assert_eq!(config.position().get(), 3);
    }

    #[test]
    fn invalid_configs_cannot_enter_through_json() {
        let config =
            ApplicationConfig::new("Example Tool", r"C:\Example\Example.exe", None, 0).unwrap();

        for (field, value) in [
            ("displayName", serde_json::json!("  ")),
            ("executablePath", serde_json::json!("relative.exe")),
            ("iconCacheKey", serde_json::json!("\t")),
            ("position", serde_json::json!(-1)),
        ] {
            let mut json = serde_json::to_value(&config).unwrap();
            json[field] = value;
            assert!(serde_json::from_value::<ApplicationConfig>(json).is_err());
        }
    }

    #[test]
    fn configs_round_trip_through_json() {
        let config = ApplicationConfig::new(
            "Example Tool",
            r"C:\Example\Example.exe",
            Some("example-icon".to_owned()),
            2,
        )
        .unwrap();
        let json = serde_json::to_string(&config).unwrap();

        assert_eq!(
            serde_json::from_str::<ApplicationConfig>(&json).unwrap(),
            config
        );
    }
}
