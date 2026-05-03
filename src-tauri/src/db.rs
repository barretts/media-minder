use std::path::PathBuf;
use std::time::UNIX_EPOCH;

use rusqlite::{params, Connection, OptionalExtension};
use serde_json;

use crate::types::{MoviePart, MovieData, ScannedMovie};

pub struct CatalogDb {
    path: PathBuf,
}

impl CatalogDb {
    pub fn new() -> Result<Self, String> {
        let path = db_file();
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let db = Self { path };
        db.init()?;
        Ok(db)
    }

    fn connection(&self) -> Result<Connection, String> {
        Connection::open(&self.path).map_err(|e| e.to_string())
    }

    fn init(&self) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS movies (
                id TEXT NOT NULL,
                file_path TEXT PRIMARY KEY,
                file_name TEXT NOT NULL,
                folder_path TEXT NOT NULL,
                folder_name TEXT NOT NULL,
                parsed_title TEXT NOT NULL,
                parsed_year INTEGER,
                has_nfo INTEGER NOT NULL,
                has_poster INTEGER NOT NULL,
                has_fanart INTEGER NOT NULL,
                nfo_path TEXT,
                poster_path TEXT,
                fanart_path TEXT,
                poster_ts INTEGER,
                fanart_ts INTEGER,
                matched INTEGER NOT NULL,
                ignored INTEGER NOT NULL,
                tmdb_id INTEGER,
                imdb_id TEXT,
                movie_data_json TEXT,
                parts_json TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                resolution TEXT NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                video_codec TEXT NOT NULL,
                audio_codec TEXT NOT NULL,
                audio_channels INTEGER NOT NULL,
                duration INTEGER NOT NULL,
                bitrate INTEGER NOT NULL,
                modified_at INTEGER,
                last_scanned_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_movies_folder_path ON movies(folder_path);
            CREATE INDEX IF NOT EXISTS idx_movies_matched ON movies(matched);
            CREATE INDEX IF NOT EXISTS idx_movies_ignored ON movies(ignored);
            "
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_movies(&self) -> Result<Vec<ScannedMovie>, String> {
        let conn = self.connection()?;
        let mut stmt = conn.prepare(
            "
            SELECT id, file_path, file_name, folder_path, folder_name, parsed_title, parsed_year,
                   has_nfo, has_poster, has_fanart, nfo_path, poster_path, fanart_path,
                   poster_ts, fanart_ts, matched, ignored, tmdb_id, imdb_id,
                   movie_data_json, parts_json, file_size, resolution, width, height,
                   video_codec, audio_codec, audio_channels, duration, bitrate
            FROM movies
            ORDER BY folder_path, file_name
            "
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| {
            let movie_data_json: Option<String> = row.get(19)?;
            let parts_json: String = row.get(20)?;
            let movie_data = movie_data_json
                .map(|s| serde_json::from_str::<MovieData>(&s))
                .transpose()
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(19, rusqlite::types::Type::Text, Box::new(e)))?;
            let parts = serde_json::from_str::<Vec<MoviePart>>(&parts_json)
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(20, rusqlite::types::Type::Text, Box::new(e)))?;

            Ok(ScannedMovie {
                id: row.get(0)?,
                file_path: row.get(1)?,
                file_name: row.get(2)?,
                folder_path: row.get(3)?,
                folder_name: row.get(4)?,
                parsed_title: row.get(5)?,
                parsed_year: row.get(6)?,
                has_nfo: row.get(7)?,
                has_poster: row.get(8)?,
                has_fanart: row.get(9)?,
                nfo_path: row.get(10)?,
                poster_path: row.get(11)?,
                fanart_path: row.get(12)?,
                poster_ts: row.get(13)?,
                fanart_ts: row.get(14)?,
                matched: row.get(15)?,
                ignored: row.get(16)?,
                tmdb_id: row.get(17)?,
                imdb_id: row.get(18)?,
                movie_data,
                parts,
                file_size: row.get(21)?,
                resolution: row.get(22)?,
                width: row.get(23)?,
                height: row.get(24)?,
                video_codec: row.get(25)?,
                audio_codec: row.get(26)?,
                audio_channels: row.get(27)?,
                duration: row.get(28)?,
                bitrate: row.get(29)?,
            })
        }).map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn save_movie(&self, movie: &ScannedMovie) -> Result<(), String> {
        let conn = self.connection()?;
        save_movie_with_conn(&conn, movie)
    }

    pub fn save_movies(&self, movies: &[ScannedMovie]) -> Result<(), String> {
        let mut conn = self.connection()?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        for movie in movies {
            save_movie_with_conn(&tx, movie)?;
        }
        tx.commit().map_err(|e| e.to_string())
    }

    pub fn replace_movies(&self, movies: &[ScannedMovie]) -> Result<(), String> {
        let mut conn = self.connection()?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM movies", []).map_err(|e| e.to_string())?;
        for movie in movies {
            save_movie_with_conn(&tx, movie)?;
        }
        tx.commit().map_err(|e| e.to_string())
    }

    pub fn delete_movie(&self, file_path: &str) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute("DELETE FROM movies WHERE file_path = ?1", [file_path]).map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn save_movie_with_conn(conn: &Connection, movie: &ScannedMovie) -> Result<(), String> {
    let movie_data_json = movie.movie_data.as_ref().map(serde_json::to_string).transpose().map_err(|e| e.to_string())?;
    let parts_json = serde_json::to_string(&movie.parts).map_err(|e| e.to_string())?;
    let modified_at = file_modified_ts(&movie.file_path);
    let last_scanned_at = now_ts();

    conn.execute(
        "
        INSERT INTO movies (
            id, file_path, file_name, folder_path, folder_name, parsed_title, parsed_year,
            has_nfo, has_poster, has_fanart, nfo_path, poster_path, fanart_path,
            poster_ts, fanart_ts, matched, ignored, tmdb_id, imdb_id,
            movie_data_json, parts_json, file_size, resolution, width, height,
            video_codec, audio_codec, audio_channels, duration, bitrate, modified_at, last_scanned_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7,
            ?8, ?9, ?10, ?11, ?12, ?13,
            ?14, ?15, ?16, ?17, ?18, ?19,
            ?20, ?21, ?22, ?23, ?24, ?25,
            ?26, ?27, ?28, ?29, ?30, ?31, ?32
        )
        ON CONFLICT(file_path) DO UPDATE SET
            id = excluded.id,
            file_name = excluded.file_name,
            folder_path = excluded.folder_path,
            folder_name = excluded.folder_name,
            parsed_title = excluded.parsed_title,
            parsed_year = excluded.parsed_year,
            has_nfo = excluded.has_nfo,
            has_poster = excluded.has_poster,
            has_fanart = excluded.has_fanart,
            nfo_path = excluded.nfo_path,
            poster_path = excluded.poster_path,
            fanart_path = excluded.fanart_path,
            poster_ts = excluded.poster_ts,
            fanart_ts = excluded.fanart_ts,
            matched = excluded.matched,
            ignored = excluded.ignored,
            tmdb_id = excluded.tmdb_id,
            imdb_id = excluded.imdb_id,
            movie_data_json = excluded.movie_data_json,
            parts_json = excluded.parts_json,
            file_size = excluded.file_size,
            resolution = excluded.resolution,
            width = excluded.width,
            height = excluded.height,
            video_codec = excluded.video_codec,
            audio_codec = excluded.audio_codec,
            audio_channels = excluded.audio_channels,
            duration = excluded.duration,
            bitrate = excluded.bitrate,
            modified_at = excluded.modified_at,
            last_scanned_at = excluded.last_scanned_at
        ",
        params![
            movie.id,
            movie.file_path,
            movie.file_name,
            movie.folder_path,
            movie.folder_name,
            movie.parsed_title,
            movie.parsed_year,
            movie.has_nfo,
            movie.has_poster,
            movie.has_fanart,
            movie.nfo_path,
            movie.poster_path,
            movie.fanart_path,
            movie.poster_ts,
            movie.fanart_ts,
            movie.matched,
            movie.ignored,
            movie.tmdb_id,
            movie.imdb_id,
            movie_data_json,
            parts_json,
            movie.file_size,
            movie.resolution,
            movie.width,
            movie.height,
            movie.video_codec,
            movie.audio_codec,
            movie.audio_channels,
            movie.duration,
            movie.bitrate,
            modified_at,
            last_scanned_at,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

fn db_file() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".mediaminder").join("catalog.db")
}

fn file_modified_ts(path: &str) -> Option<u64> {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

fn now_ts() -> u64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
