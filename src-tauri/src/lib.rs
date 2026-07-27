mod commands;
mod domain;
mod embedding;
mod storage;
mod windows;

pub const APP_NAME: &str = "SmartSpace";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
