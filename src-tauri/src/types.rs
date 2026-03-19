use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub movie_directories: Vec<String>,
    #[serde(default = "default_naming")]
    pub naming_convention: String,
    #[serde(default = "default_true")]
    pub download_poster: bool,
    #[serde(default = "default_true")]
    pub download_fanart: bool,
    #[serde(default)]
    pub download_actor_thumbs: bool,
    #[serde(default = "default_true")]
    pub auto_save_nfo: bool,
    #[serde(default = "default_true")]
    pub auto_save_images: bool,
    #[serde(default = "default_lang")]
    pub language: String,
    #[serde(default)]
    pub ignored_paths: Vec<String>,
    #[serde(default)]
    pub cleanup_strings: Vec<String>,
    #[serde(default)]
    pub ignored_duplicate_groups: Vec<String>,
}

fn default_naming() -> String { "filename".to_string() }
fn default_true() -> bool { true }
fn default_lang() -> String { "en-US".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScannedMovie {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub folder_path: String,
    pub folder_name: String,
    pub parsed_title: String,
    pub parsed_year: Option<i32>,
    pub has_nfo: bool,
    pub has_poster: bool,
    pub has_fanart: bool,
    pub nfo_path: Option<String>,
    pub poster_path: Option<String>,
    pub fanart_path: Option<String>,
    #[serde(default)]
    pub poster_ts: Option<u64>,
    #[serde(default)]
    pub fanart_ts: Option<u64>,
    pub matched: bool,
    pub ignored: bool,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub movie_data: Option<MovieData>,
    #[serde(default)]
    pub parts: Vec<MoviePart>,
    #[serde(default)]
    pub file_size: u64,
    #[serde(default)]
    pub resolution: String,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
    #[serde(default)]
    pub video_codec: String,
    #[serde(default)]
    pub audio_codec: String,
    #[serde(default)]
    pub audio_channels: u32,
    #[serde(default)]
    pub duration: u64,
    #[serde(default)]
    pub bitrate: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MoviePart {
    pub part_num: i32,
    pub file_path: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MovieData {
    pub title: String,
    pub original_title: String,
    pub sort_title: String,
    #[serde(default)]
    pub set: String,
    #[serde(default)]
    pub rating: f64,
    #[serde(default)]
    pub year: i32,
    #[serde(default)]
    pub votes: i64,
    #[serde(default)]
    pub outline: String,
    #[serde(default)]
    pub plot: String,
    #[serde(default)]
    pub tagline: String,
    #[serde(default)]
    pub runtime: i32,
    #[serde(default)]
    pub thumb_url: String,
    #[serde(default)]
    pub poster_url: String,
    #[serde(default)]
    pub fanart_url: String,
    #[serde(default)]
    pub mpaa: String,
    #[serde(default)]
    pub imdb_id: String,
    #[serde(default)]
    pub tmdb_id: i64,
    #[serde(default)]
    pub trailer: String,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(default)]
    pub directors: Vec<String>,
    #[serde(default)]
    pub writers: Vec<String>,
    #[serde(default)]
    pub studios: Vec<String>,
    #[serde(default)]
    pub countries: Vec<String>,
    #[serde(default)]
    pub actors: Vec<ActorData>,
    #[serde(default)]
    pub fileinfo: Option<FileInfo>,
    #[serde(default)]
    pub video_codec: String,
    #[serde(default)]
    pub audio_codec: String,
    #[serde(default)]
    pub audio_channels: u32,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
    #[serde(default)]
    pub duration: u64,
    #[serde(default)]
    pub bitrate: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActorData {
    pub name: String,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub thumb: String,
    #[serde(default)]
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    #[serde(default)]
    pub video_codec: String,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
    #[serde(default)]
    pub resolution: String,
    #[serde(default)]
    pub duration: u64,
    #[serde(default)]
    pub bitrate: u64,
    #[serde(default)]
    pub audio_codec: String,
    #[serde(default)]
    pub audio_channels: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbSearchResult {
    pub id: i64,
    pub title: String,
    pub original_title: String,
    pub year: i32,
    pub overview: String,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub vote_average: f64,
    pub vote_count: i64,
    pub release_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImdbSearchResult {
    pub imdb_id: String,
    pub title: String,
    pub year: i32,
    pub poster_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageEntry {
    pub url: String,
    pub preview_url: String,
    pub width: u32,
    pub height: u32,
    pub lang: String,
    pub rating: f64,
}
