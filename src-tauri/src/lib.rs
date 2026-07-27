mod commands;
pub mod domain;
mod embedding;
pub mod storage;
mod windows;

use storage::DatabaseState;
use tauri::Manager;

pub const APP_NAME: &str = "SmartSpace";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_directory = app.path().app_data_dir()?;
            app.manage(DatabaseState::initialize(data_directory)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::categories::create_category,
            commands::categories::list_categories,
            commands::tasks::create_task,
            commands::tasks::list_tasks,
            commands::tasks::rename_task,
            commands::tasks::set_task_due_date,
            commands::tasks::set_task_status
        ])
        .run(tauri::generate_context!())
        .expect("failed to run SmartSpace");
}

#[cfg(test)]
mod tests {
    use super::APP_NAME;

    #[test]
    fn uses_the_locked_product_name() {
        assert_eq!(APP_NAME, "SmartSpace");
    }
}
