mod types;
mod settings;
mod scanner;
mod scraper;
mod nfo;
mod images;
mod commands;

use commands::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_settings = settings::load_settings();

    tauri::Builder::default()
        .manage(AppState {
            settings: Mutex::new(initial_settings),
            movies: Mutex::new(Vec::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::scan,
            commands::get_movies,
            commands::search,
            commands::movie_details,
            commands::process_movie,
            commands::auto_match,
            commands::save_nfo_cmd,
            commands::download_images_cmd,
            commands::ignore_movie,
            commands::unset_movie,
            commands::imdb_search_cmd,
            commands::imdb_process,
            commands::get_movie_images,
            commands::save_image_cmd,
            commands::delete_image_cmd,
            commands::get_duplicates,
            commands::delete_movie_file,
            commands::probe_all,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
