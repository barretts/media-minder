use std::fs;
use std::path::PathBuf;
use crate::types::AppSettings;

fn config_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".mediaminder")
}

fn config_file() -> PathBuf {
    config_dir().join("settings.json")
}

pub fn load_settings() -> AppSettings {
    let path = config_file();
    if path.exists() {
        if let Ok(data) = fs::read_to_string(&path) {
            if let Ok(s) = serde_json::from_str::<AppSettings>(&data) {
                return s;
            }
        }
    }
    AppSettings {
        movie_directories: vec!["G:\\movies".to_string()],
        naming_convention: "filename".to_string(),
        download_poster: true,
        download_fanart: true,
        download_actor_thumbs: false,
        auto_save_nfo: true,
        auto_save_images: true,
        language: "en-US".to_string(),
        ignored_paths: vec![],
        cleanup_strings: vec![],
        ignored_duplicate_groups: vec![],
    }
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(config_file(), json).map_err(|e| e.to_string())?;
    Ok(())
}
