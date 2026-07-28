use std::{fs, path::PathBuf};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use super::CommandError;

#[tauri::command]
pub(crate) async fn pick_application_executable(
    app: AppHandle,
) -> Result<Option<String>, CommandError> {
    let selection = app
        .dialog()
        .file()
        .set_title("Choose a Windows application")
        .add_filter("Windows applications", &["exe"])
        .blocking_pick_file();
    let path = selection
        .map(|selection| {
            selection
                .into_path()
                .map_err(|error| CommandError::invalid_input(error.to_string()))
        })
        .transpose()?;

    selected_executable_path(path)
}

fn selected_executable_path(path: Option<PathBuf>) -> Result<Option<String>, CommandError> {
    path.map(validate_selected_executable).transpose()
}

fn validate_selected_executable(path: PathBuf) -> Result<String, CommandError> {
    if !path.is_absolute() {
        return Err(CommandError::invalid_input(
            "selected executable path must be absolute",
        ));
    }

    let path_string = path.to_str().ok_or_else(|| {
        CommandError::invalid_input("selected executable path is not valid Unicode")
    })?;
    let is_executable = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"));
    if !is_executable {
        return Err(CommandError::invalid_input(
            "selected file must have an .exe extension",
        ));
    }

    let metadata = fs::metadata(&path)
        .map_err(|_| CommandError::invalid_input("selected executable is no longer available"))?;
    if !metadata.is_file() {
        return Err(CommandError::invalid_input(
            "selected executable must be a file",
        ));
    }

    Ok(path_string.to_owned())
}

#[cfg(test)]
mod tests {
    use std::{ffi::OsString, fs, path::PathBuf};

    use serde_json::json;
    use uuid::Uuid;

    use super::{selected_executable_path, validate_selected_executable};

    #[test]
    fn cancelled_selection_returns_none() {
        assert_eq!(selected_executable_path(None).unwrap(), None);
    }

    #[test]
    fn existing_absolute_executable_is_returned_without_rewriting() {
        let root = temporary_root();
        fs::create_dir_all(&root).unwrap();
        let executable = root.join("Example Tool.EXE");
        fs::write(&executable, b"test executable placeholder").unwrap();

        let selected = validate_selected_executable(executable.clone()).unwrap();

        assert_eq!(selected, executable.to_str().unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_selections_return_stable_invalid_input_errors() {
        let root = temporary_root();
        fs::create_dir_all(&root).unwrap();
        let wrong_extension = root.join("script.cmd");
        fs::write(&wrong_extension, b"not an executable").unwrap();
        let executable_directory = root.join("folder.exe");
        fs::create_dir(&executable_directory).unwrap();

        for path in [
            PathBuf::from("relative.exe"),
            wrong_extension,
            executable_directory,
            root.join("missing.exe"),
        ] {
            let error = validate_selected_executable(path).unwrap_err();
            let serialized = serde_json::to_value(error).unwrap();
            assert_eq!(serialized["code"], json!("invalid_input"));
            assert!(serialized["message"]
                .as_str()
                .is_some_and(|message| !message.is_empty()));
        }

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn non_unicode_windows_paths_are_rejected_before_file_access() {
        use std::os::windows::ffi::OsStringExt;

        let path = PathBuf::from(OsString::from_wide(&[
            b'C' as u16,
            b':' as u16,
            b'\\' as u16,
            0xD800,
            b'.' as u16,
            b'e' as u16,
            b'x' as u16,
            b'e' as u16,
        ]));

        let error = validate_selected_executable(path).unwrap_err();
        assert_eq!(
            serde_json::to_value(error).unwrap()["code"],
            json!("invalid_input")
        );
    }

    fn temporary_root() -> PathBuf {
        std::env::temp_dir().join(format!(
            "smartspace-command-applications-{}",
            Uuid::new_v4()
        ))
    }
}
