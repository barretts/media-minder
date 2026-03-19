use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::{State, AppHandle, Emitter};
use crate::types::*;
use crate::settings;
use crate::scanner;
use crate::scraper;
use crate::nfo;
use crate::images;

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub movies: Mutex<Vec<ScannedMovie>>,
}

// --- Settings ---

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<AppSettings, String> {
    Ok(state.settings.lock().unwrap().clone())
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, new_settings: AppSettings) -> Result<bool, String> {
    settings::save_settings(&new_settings)?;
    *state.settings.lock().unwrap() = new_settings;
    Ok(true)
}

#[tauri::command]
pub fn set_ignored_duplicate_groups(state: State<AppState>, groups: Vec<String>) -> Result<bool, String> {
    let mut s = state.settings.lock().unwrap();
    s.ignored_duplicate_groups = groups;
    settings::save_settings(&s).map(|_| true)
}

// --- Scan ---

#[tauri::command]
pub async fn scan(state: State<'_, AppState>, app: AppHandle) -> Result<serde_json::Value, String> {
    let dirs = state.settings.lock().unwrap().movie_directories.clone();
    let ignored_paths = state.settings.lock().unwrap().ignored_paths.clone();
    let ignored_set: std::collections::HashSet<String> = ignored_paths.into_iter().collect();

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Vec<ScannedMovie>>();

    // Spawn the blocking scanner in a background thread
    let scan_handle = tokio::task::spawn_blocking(move || {
        scanner::scan_directories_streaming(&dirs, tx)
    });

    // Emit batches as they arrive from the scanner
    let ignored_ref = ignored_set.clone();
    while let Some(mut batch) = rx.recv().await {
        for m in &mut batch {
            if ignored_ref.contains(&m.file_path) {
                m.ignored = true;
            }
        }
        let _ = app.emit("scan-progress", serde_json::json!({ "movies": batch }));
    }

    // Wait for the full scan to complete and get the grouped result
    let mut movies = scan_handle.await.map_err(|e| e.to_string())?;

    for m in &mut movies {
        if ignored_set.contains(&m.file_path) {
            m.ignored = true;
        }
    }

    let total = movies.len();
    *state.movies.lock().unwrap() = movies.clone();
    Ok(serde_json::json!({ "movies": movies, "total": total }))
}

#[tauri::command]
pub fn get_movies(state: State<AppState>) -> Result<serde_json::Value, String> {
    let movies = state.movies.lock().unwrap().clone();
    Ok(serde_json::json!({ "movies": movies }))
}

// --- TMDB Search & Match ---

#[tauri::command]
pub async fn search(query: String, year: Option<i32>) -> Result<serde_json::Value, String> {
    let results = scraper::tmdb_search(&query, year).await?;
    Ok(serde_json::json!({ "results": results }))
}

#[tauri::command]
pub async fn movie_details(tmdb_id: i64) -> Result<serde_json::Value, String> {
    let data = scraper::tmdb_movie_details(tmdb_id).await?;
    Ok(serde_json::json!({ "data": data }))
}

#[tauri::command]
pub async fn process_movie(state: State<'_, AppState>, movie_id: String, tmdb_id: i64) -> Result<serde_json::Value, String> {
    let data = scraper::tmdb_movie_details(tmdb_id).await?;
    let settings = state.settings.lock().unwrap().clone();

    let movie_ref = {
        let mut movies = state.movies.lock().unwrap();
        let idx = movies.iter().position(|m| m.id == movie_id)
            .ok_or("Movie not found")?;
        // Delete old art before applying new match
        if let Some(ref p) = movies[idx].poster_path.clone() { images::delete_image_file(p); }
        if let Some(ref f) = movies[idx].fanart_path.clone() { images::delete_image_file(f); }
        movies[idx].has_poster = false; movies[idx].poster_path = None; movies[idx].poster_ts = None;
        movies[idx].has_fanart = false; movies[idx].fanart_path = None; movies[idx].fanart_ts = None;
        movies[idx].matched = true;
        movies[idx].tmdb_id = Some(data.tmdb_id);
        movies[idx].imdb_id = if data.imdb_id.is_empty() { None } else { Some(data.imdb_id.clone()) };
        movies[idx].movie_data = Some(data.clone());
        if settings.auto_save_nfo {
            let nfo_path = nfo::save_nfo(&movies[idx], &data, &settings.naming_convention)?;
            movies[idx].has_nfo = true;
            movies[idx].nfo_path = Some(nfo_path);
        }
        movies[idx].clone()
    }; // lock dropped here

    if settings.auto_save_images {
        let (poster, fanart) = images::download_movie_images(
            &movie_ref, &data, &settings.naming_convention,
            settings.download_poster, settings.download_fanart, settings.download_actor_thumbs,
        ).await?;
        let mut movies = state.movies.lock().unwrap();
        let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
        if let Some(p) = poster { movies[idx].has_poster = true; movies[idx].poster_path = Some(p); }
        if let Some(f) = fanart { movies[idx].has_fanart = true; movies[idx].fanart_path = Some(f); }
        Ok(serde_json::json!({ "movie": movies[idx] }))
    } else {
        let movies = state.movies.lock().unwrap();
        let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
        Ok(serde_json::json!({ "movie": movies[idx] }))
    }
}

#[tauri::command]
pub async fn auto_match(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let cleanup_strings = state.settings.lock().unwrap().cleanup_strings.clone();
    let settings = state.settings.lock().unwrap().clone();

    let unmatched: Vec<(usize, String, Option<i32>, String)> = {
        let movies = state.movies.lock().unwrap();
        movies.iter().enumerate()
            .filter(|(_, m)| !m.matched && !m.has_nfo && !m.ignored)
            .map(|(i, m)| (i, m.parsed_title.clone(), m.parsed_year, m.id.clone()))
            .collect()
    };

    let mut results = Vec::new();

    for (_, parsed_title, parsed_year, movie_id) in &unmatched {
        let mut search_title = parsed_title.clone();
        for s in &cleanup_strings {
            search_title = search_title.replace(s.as_str(), "").trim().to_string();
        }
        search_title = search_title.trim_matches(|c: char| " -_.,".contains(c)).to_string();

        // Try TMDB
        let mut data: Option<MovieData> = None;
        let mut source = "";

        if let Ok(search_results) = scraper::tmdb_search(&search_title, *parsed_year).await {
            if let Some(first) = search_results.first() {
                if let Ok(details) = scraper::tmdb_movie_details(first.id).await {
                    data = Some(details);
                    source = "tmdb";
                }
            }
        }

        // Fallback to IMDB
        if data.is_none() {
            if let Ok(imdb_results) = scraper::imdb_search(&search_title, *parsed_year).await {
                if let Some(first) = imdb_results.first() {
                    if let Ok(Some(details)) = scraper::imdb_movie_details(&first.imdb_id).await {
                        data = Some(details);
                        source = "imdb";
                    }
                }
            }
        }

        if let Some(movie_data) = data {
            // Apply match — scoped lock
            let movie_ref = {
                let mut movies = state.movies.lock().unwrap();
                if let Some(idx) = movies.iter().position(|m| m.id == *movie_id) {
                    movies[idx].matched = true;
                    movies[idx].tmdb_id = if movie_data.tmdb_id > 0 { Some(movie_data.tmdb_id) } else { None };
                    movies[idx].imdb_id = if movie_data.imdb_id.is_empty() { None } else { Some(movie_data.imdb_id.clone()) };
                    movies[idx].movie_data = Some(movie_data.clone());
                    if settings.auto_save_nfo {
                        if let Ok(nfo_path) = nfo::save_nfo(&movies[idx], &movie_data, &settings.naming_convention) {
                            movies[idx].has_nfo = true;
                            movies[idx].nfo_path = Some(nfo_path);
                        }
                    }
                    Some(movies[idx].clone())
                } else { None }
            }; // lock dropped

            if settings.auto_save_images {
                if let Some(mref) = movie_ref {
                    let (poster, fanart) = images::download_movie_images(
                        &mref, &movie_data, &settings.naming_convention,
                        settings.download_poster, settings.download_fanart, settings.download_actor_thumbs,
                    ).await.unwrap_or((None, None));
                    let mut movies = state.movies.lock().unwrap();
                    if let Some(idx) = movies.iter().position(|m| m.id == *movie_id) {
                        if let Some(p) = poster { movies[idx].has_poster = true; movies[idx].poster_path = Some(p); }
                        if let Some(f) = fanart { movies[idx].has_fanart = true; movies[idx].fanart_path = Some(f); }
                    }
                }
            }
            results.push(serde_json::json!({ "movieId": movie_id, "success": true, "source": source }));
        } else {
            results.push(serde_json::json!({ "movieId": movie_id, "success": false, "error": "No results on TMDB or IMDB" }));
        }
    }

    let movies = state.movies.lock().unwrap().clone();
    Ok(serde_json::json!({ "results": results, "movies": movies }))
}

// --- Save NFO / Download Images ---

#[tauri::command]
pub fn save_nfo_cmd(state: State<AppState>, movie_id: String) -> Result<serde_json::Value, String> {
    let mut movies = state.movies.lock().unwrap();
    let settings = state.settings.lock().unwrap().clone();
    let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
    let data = movies[idx].movie_data.as_ref().ok_or("Movie not matched yet")?.clone();
    let nfo_path = nfo::save_nfo(&movies[idx], &data, &settings.naming_convention)?;
    movies[idx].has_nfo = true;
    movies[idx].nfo_path = Some(nfo_path.clone());
    Ok(serde_json::json!({ "nfoPath": nfo_path }))
}

#[tauri::command]
pub async fn download_images_cmd(state: State<'_, AppState>, movie_id: String) -> Result<serde_json::Value, String> {
    let (movie_ref, data, settings) = {
        let movies = state.movies.lock().unwrap();
        let s = state.settings.lock().unwrap().clone();
        let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
        let d = movies[idx].movie_data.as_ref().ok_or("Movie not matched yet")?.clone();
        (movies[idx].clone(), d, s)
    };

    let (poster, fanart) = images::download_movie_images(
        &movie_ref, &data, &settings.naming_convention,
        settings.download_poster, settings.download_fanart, settings.download_actor_thumbs,
    ).await?;

    let mut movies = state.movies.lock().unwrap();
    let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
    if let Some(p) = &poster { movies[idx].has_poster = true; movies[idx].poster_path = Some(p.clone()); }
    if let Some(f) = &fanart { movies[idx].has_fanart = true; movies[idx].fanart_path = Some(f.clone()); }

    Ok(serde_json::json!({ "result": { "poster": poster, "fanart": fanart } }))
}

// --- Ignore ---

#[tauri::command]
pub fn ignore_movie(state: State<AppState>, movie_id: String, ignored: bool) -> Result<serde_json::Value, String> {
    let mut movies = state.movies.lock().unwrap();
    let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
    movies[idx].ignored = ignored;

    // Persist to settings
    let mut settings = state.settings.lock().unwrap();
    let mut ignored_paths: std::collections::HashSet<String> = settings.ignored_paths.iter().cloned().collect();
    if ignored {
        ignored_paths.insert(movies[idx].file_path.clone());
    } else {
        ignored_paths.remove(&movies[idx].file_path);
    }
    settings.ignored_paths = ignored_paths.into_iter().collect();
    let _ = crate::settings::save_settings(&settings);

    Ok(serde_json::json!({ "movie": movies[idx] }))
}

// --- Unset ---

#[tauri::command]
pub fn unset_movie(state: State<AppState>, movie_id: String) -> Result<serde_json::Value, String> {
    let mut movies = state.movies.lock().unwrap();
    let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
    let mut deleted = Vec::new();

    for field in [&movies[idx].nfo_path, &movies[idx].poster_path, &movies[idx].fanart_path] {
        if let Some(path) = field {
            if Path::new(path).is_file() {
                if let Ok(()) = fs::remove_file(path) {
                    deleted.push(path.clone());
                }
            }
        }
    }

    movies[idx].matched = false;
    movies[idx].movie_data = None;
    movies[idx].tmdb_id = None;
    movies[idx].imdb_id = None;
    movies[idx].has_nfo = false;
    movies[idx].nfo_path = None;
    movies[idx].has_poster = false;
    movies[idx].poster_path = None;
    movies[idx].has_fanart = false;
    movies[idx].fanart_path = None;

    Ok(serde_json::json!({ "movie": movies[idx], "deleted": deleted }))
}

// --- IMDB ---

#[tauri::command]
pub async fn imdb_search_cmd(query: String, year: Option<i32>) -> Result<serde_json::Value, String> {
    let results = scraper::imdb_search(&query, year).await?;
    Ok(serde_json::json!({ "results": results }))
}

#[tauri::command]
pub async fn imdb_process(state: State<'_, AppState>, movie_id: String, imdb_id: String) -> Result<serde_json::Value, String> {
    // Try TMDB lookup via IMDB ID first, fall back to IMDB scraping
    let data = match scraper::tmdb_find_by_imdb(&imdb_id).await? {
        Some(d) => d,
        None => scraper::imdb_movie_details(&imdb_id).await?
            .ok_or("Failed to fetch movie details")?,
    };

    let settings = state.settings.lock().unwrap().clone();
    {
        let mut movies = state.movies.lock().unwrap();
        let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
        movies[idx].matched = true;
        movies[idx].tmdb_id = if data.tmdb_id > 0 { Some(data.tmdb_id) } else { None };
        movies[idx].imdb_id = if data.imdb_id.is_empty() { None } else { Some(data.imdb_id.clone()) };
        movies[idx].movie_data = Some(data.clone());

        if settings.auto_save_nfo {
            if let Ok(nfo_path) = nfo::save_nfo(&movies[idx], &data, &settings.naming_convention) {
                movies[idx].has_nfo = true;
                movies[idx].nfo_path = Some(nfo_path);
            }
        }
    }

    if settings.auto_save_images {
        let movie_ref = state.movies.lock().unwrap().iter().find(|m| m.id == movie_id).cloned().ok_or("Movie not found")?;
        let (poster, fanart) = images::download_movie_images(
            &movie_ref, &data, &settings.naming_convention,
            settings.download_poster, settings.download_fanart, settings.download_actor_thumbs,
        ).await.unwrap_or((None, None));
        let mut movies = state.movies.lock().unwrap();
        if let Some(idx) = movies.iter().position(|m| m.id == movie_id) {
            if let Some(p) = poster { movies[idx].has_poster = true; movies[idx].poster_path = Some(p); }
            if let Some(f) = fanart { movies[idx].has_fanart = true; movies[idx].fanart_path = Some(f); }
        }
    }

    let movies = state.movies.lock().unwrap();
    let movie = movies.iter().find(|m| m.id == movie_id).ok_or("Movie not found")?;
    Ok(serde_json::json!({ "movie": movie }))
}

// --- Images ---

#[tauri::command]
pub async fn get_movie_images(state: State<'_, AppState>, movie_id: String) -> Result<serde_json::Value, String> {
    let (tmdb_id, poster_url, fanart_url) = {
        let movies = state.movies.lock().unwrap();
        let movie = movies.iter().find(|m| m.id == movie_id).ok_or("Movie not found")?;
        let data = movie.movie_data.as_ref().ok_or("Movie not matched yet")?;
        (data.tmdb_id, data.poster_url.clone(), data.fanart_url.clone())
    }; // lock dropped

    let (mut posters, mut fanarts) = if tmdb_id > 0 {
        scraper::tmdb_movie_images(tmdb_id).await.unwrap_or_default()
    } else {
        (vec![], vec![])
    };

    if posters.is_empty() && !poster_url.is_empty() {
        posters.push(ImageEntry { url: poster_url.clone(), preview_url: poster_url, width: 0, height: 0, lang: "en".to_string(), rating: 0.0 });
    }
    if fanarts.is_empty() && !fanart_url.is_empty() {
        fanarts.push(ImageEntry { url: fanart_url.clone(), preview_url: fanart_url, width: 0, height: 0, lang: String::new(), rating: 0.0 });
    }

    Ok(serde_json::json!({ "posters": posters, "fanarts": fanarts }))
}

#[tauri::command]
pub async fn save_image_cmd(state: State<'_, AppState>, movie_id: String, image_url: String, image_type: String) -> Result<serde_json::Value, String> {
    let (folder_path, file_path, naming) = {
        let movies = state.movies.lock().unwrap();
        let settings = state.settings.lock().unwrap();
        let movie = movies.iter().find(|m| m.id == movie_id).ok_or("Movie not found")?;
        (movie.folder_path.clone(), movie.file_path.clone(), settings.naming_convention.clone())
    };

    let saved_path = images::save_single_image(&folder_path, &file_path, &image_url, &image_type, &naming).await?;
    let ts = fs::metadata(&saved_path).ok().and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let mut movies = state.movies.lock().unwrap();
    let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
    if image_type == "poster" {
        movies[idx].has_poster = true;
        movies[idx].poster_path = Some(saved_path);
        movies[idx].poster_ts = Some(ts);
    } else {
        movies[idx].has_fanart = true;
        movies[idx].fanart_path = Some(saved_path);
        movies[idx].fanart_ts = Some(ts);
    }

    Ok(serde_json::json!({ "movie": movies[idx] }))
}

#[tauri::command]
pub fn delete_image_cmd(state: State<AppState>, movie_id: String, image_type: String) -> Result<serde_json::Value, String> {
    let mut movies = state.movies.lock().unwrap();
    let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
    if image_type == "poster" {
        if let Some(ref p) = movies[idx].poster_path.clone() {
            images::delete_image_file(p);
        }
        movies[idx].has_poster = false;
        movies[idx].poster_path = None;
        movies[idx].poster_ts = None;
    } else {
        if let Some(ref f) = movies[idx].fanart_path.clone() {
            images::delete_image_file(f);
        }
        movies[idx].has_fanart = false;
        movies[idx].fanart_path = None;
        movies[idx].fanart_ts = None;
    }
    Ok(serde_json::json!({ "movie": movies[idx] }))
}

// --- Duplicates ---

#[tauri::command]
pub async fn get_duplicates(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let movies = state.movies.lock().unwrap().clone();

    let result = tokio::task::spawn_blocking(move || {
        let candidates: Vec<&ScannedMovie> = movies.iter().filter(|m| !m.ignored).collect();
        let n = candidates.len();

        // Union-Find
        let mut parent: Vec<usize> = (0..n).collect();
        fn find(parent: &mut Vec<usize>, x: usize) -> usize {
            if parent[x] != x { parent[x] = find(parent, parent[x]); }
            parent[x]
        }
        fn union(parent: &mut Vec<usize>, x: usize, y: usize) {
            let rx = find(parent, x);
            let ry = find(parent, y);
            if rx != ry { parent[rx] = ry; }
        }

        // Build lookup maps: tmdb_id -> first index, imdb_id -> first index, title_year -> first index
        let mut tmdb_map: HashMap<i64, usize> = HashMap::new();
        let mut imdb_map: HashMap<String, usize> = HashMap::new();
        let mut title_map: HashMap<(String, Option<i32>), usize> = HashMap::new();

        for (i, m) in candidates.iter().enumerate() {
            // Title+year key
            let tk = (m.parsed_title.to_lowercase().trim().to_string(), m.parsed_year);
            if let Some(&j) = title_map.get(&tk) { union(&mut parent, i, j); }
            else { title_map.insert(tk, i); }

            // TMDB id
            if let Some(tid) = m.tmdb_id.filter(|&t| t > 0) {
                if let Some(&j) = tmdb_map.get(&tid) { union(&mut parent, i, j); }
                else { tmdb_map.insert(tid, i); }
            }

            // IMDB id
            if let Some(ref iid) = m.imdb_id {
                if !iid.is_empty() {
                    if let Some(&j) = imdb_map.get(iid) { union(&mut parent, i, j); }
                    else { imdb_map.insert(iid.clone(), i); }
                }
            }
        }

        // Collect groups by root
        let mut root_groups: HashMap<usize, Vec<&ScannedMovie>> = HashMap::new();
        for i in 0..n {
            let root = find(&mut parent, i);
            root_groups.entry(root).or_default().push(candidates[i]);
        }

        // Build display name for a group: prefer matched title, fall back to parsed
        let display_name = |group: &Vec<&ScannedMovie>| -> String {
            let title = group.iter()
                .find_map(|m| m.movie_data.as_ref().map(|d| d.title.clone()))
                .unwrap_or_else(|| group[0].parsed_title.clone());
            let year = group.iter().find_map(|m| m.parsed_year)
                .map(|y| y.to_string()).unwrap_or_else(|| "?".to_string());
            format!("{} ({})", title, year)
        };

        let mut dupes: HashMap<String, Vec<serde_json::Value>> = HashMap::new();
        let mut total = 0usize;

        for (_root, group) in &root_groups {
            if group.len() < 2 { continue; }
            let mut enriched = Vec::new();
            for m in group {
                let info = m.movie_data.as_ref().and_then(|d| d.fileinfo.clone());
                let probe = info.unwrap_or_else(|| scanner::probe_video(&m.file_path));
                let mut val = serde_json::to_value(m).unwrap_or_default();
                if let Some(obj) = val.as_object_mut() {
                    obj.insert("resolution".to_string(), serde_json::json!(probe.resolution));
                    obj.insert("width".to_string(), serde_json::json!(probe.width));
                    obj.insert("height".to_string(), serde_json::json!(probe.height));
                    obj.insert("videoCodec".to_string(), serde_json::json!(probe.video_codec));
                    obj.insert("audioCodec".to_string(), serde_json::json!(probe.audio_codec));
                    obj.insert("audioChannels".to_string(), serde_json::json!(probe.audio_channels));
                    obj.insert("duration".to_string(), serde_json::json!(probe.duration));
                    obj.insert("bitrate".to_string(), serde_json::json!(probe.bitrate));
                }
                enriched.push(val);
            }
            let key = display_name(group);
            total += enriched.len();
            dupes.insert(key, enriched);
        }

        serde_json::json!({ "groups": dupes, "totalDuplicates": total })
    }).await.map_err(|e| e.to_string())?;

    Ok(result)
}

// --- Delete ---

#[tauri::command]
pub fn delete_movie_file(state: State<AppState>, movie_id: String) -> Result<serde_json::Value, String> {
    let mut movies = state.movies.lock().unwrap();
    let idx = movies.iter().position(|m| m.id == movie_id).ok_or("Movie not found")?;
    let mut deleted = Vec::new();

    // Delete video file
    if Path::new(&movies[idx].file_path).is_file() {
        fs::remove_file(&movies[idx].file_path).map_err(|e| format!("Failed to delete video: {}", e))?;
        deleted.push(movies[idx].file_path.clone());
    }

    // Delete companions
    for field in [&movies[idx].nfo_path, &movies[idx].poster_path, &movies[idx].fanart_path] {
        if let Some(path) = field {
            if Path::new(path).is_file() {
                if let Ok(()) = fs::remove_file(path) {
                    deleted.push(path.clone());
                }
            }
        }
    }

    movies.remove(idx);
    Ok(serde_json::json!({ "deleted": deleted, "movieId": movie_id }))
}

// --- Probe All ---

#[tauri::command]
pub async fn probe_all(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let mut movies = state.movies.lock().unwrap().clone();

    let (updated_movies, probed, skipped, failed) = tokio::task::spawn_blocking(move || {
        let mut probed = 0u32;
        let mut skipped = 0u32;
        let mut failed = 0u32;

        for m in movies.iter_mut() {
            if m.ignored { skipped += 1; continue; }
            let cached = m.movie_data.as_ref().and_then(|d| d.fileinfo.as_ref());
            if cached.map(|f| f.width > 0).unwrap_or(false) { skipped += 1; continue; }

            let probe = scanner::probe_video(&m.file_path);
            if probe.width == 0 { failed += 1; continue; }

            if let Some(ref mut data) = m.movie_data {
                data.fileinfo = Some(probe.clone());
                data.video_codec = probe.video_codec.clone();
                data.audio_codec = probe.audio_codec.clone();
                data.audio_channels = probe.audio_channels;
                data.width = probe.width;
                data.height = probe.height;
                data.duration = probe.duration;
                data.bitrate = probe.bitrate;
            }

            if let Some(ref nfo_path) = m.nfo_path {
                if Path::new(nfo_path).is_file() {
                    let _ = nfo::update_nfo_fileinfo(nfo_path, &probe);
                }
            }
            probed += 1;
        }

        (movies, probed, skipped, failed)
    }).await.map_err(|e| e.to_string())?;

    *state.movies.lock().unwrap() = updated_movies;
    Ok(serde_json::json!({ "probed": probed, "skipped": skipped, "failed": failed }))
}
