use std::fs;
use std::path::Path;
use reqwest::Client;
use crate::types::{ScannedMovie, MovieData};

async fn download_image(url: &str, dest: &str) -> Result<bool, String> {
    if url.is_empty() { return Ok(false); }
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Ok(false); }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    if let Some(parent) = Path::new(dest).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(dest, &bytes).map_err(|e| e.to_string())?;
    Ok(true)
}

pub async fn download_movie_images(
    movie: &ScannedMovie,
    data: &MovieData,
    naming: &str,
    download_poster: bool,
    download_fanart: bool,
    download_actor_thumbs: bool,
) -> Result<(Option<String>, Option<String>), String> {
    let name_no_ext = Path::new(&movie.file_path)
        .file_stem().and_then(|s| s.to_str()).unwrap_or("movie");

    let mut poster_result: Option<String> = None;
    let mut fanart_result: Option<String> = None;

    if download_poster && !data.poster_url.is_empty() {
        let poster_name = if naming == "folder" {
            "poster.jpg".to_string()
        } else {
            format!("{}-poster.jpg", name_no_ext)
        };
        let poster_path = Path::new(&movie.folder_path).join(&poster_name);
        let dest = poster_path.to_string_lossy().to_string();
        if download_image(&data.poster_url, &dest).await? {
            poster_result = Some(dest);
        }
    }

    if download_fanart && !data.fanart_url.is_empty() {
        let fanart_name = if naming == "folder" {
            "fanart.jpg".to_string()
        } else {
            format!("{}-fanart.jpg", name_no_ext)
        };
        let fanart_path = Path::new(&movie.folder_path).join(&fanart_name);
        let dest = fanart_path.to_string_lossy().to_string();
        if download_image(&data.fanart_url, &dest).await? {
            fanart_result = Some(dest);
        }
    }

    if download_actor_thumbs {
        if let Ok(()) = fs::create_dir_all(Path::new(&movie.folder_path).join(".actors")) {
            for actor in &data.actors {
                if !actor.thumb.is_empty() {
                    let safe_name: String = actor.name.chars()
                        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
                        .collect();
                    let actor_path = Path::new(&movie.folder_path).join(".actors").join(format!("{}.jpg", safe_name));
                    let _ = download_image(&actor.thumb, &actor_path.to_string_lossy()).await;
                }
            }
        }
    }

    Ok((poster_result, fanart_result))
}

pub fn delete_image_file(path: &str) {
    if !path.is_empty() {
        let _ = fs::remove_file(path);
    }
}

pub async fn save_single_image(folder_path: &str, file_path: &str, image_url: &str, image_type: &str, naming: &str) -> Result<String, String> {
    let name_no_ext = Path::new(file_path)
        .file_stem().and_then(|s| s.to_str()).unwrap_or("movie");

    let dest_name = if naming == "folder" {
        format!("{}.jpg", image_type)
    } else {
        format!("{}-{}.jpg", name_no_ext, image_type)
    };
    let dest = Path::new(folder_path).join(&dest_name);
    let dest_str = dest.to_string_lossy().to_string();

    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(image_url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    Ok(dest_str)
}
