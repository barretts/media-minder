use std::collections::HashMap;
use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;
use regex::Regex;
use walkdir::WalkDir;
use crate::types::{ScannedMovie, MoviePart, FileInfo};
use crate::nfo::read_nfo;

const VIDEO_EXTENSIONS: &[&str] = &[
    "mkv", "mp4", "avi", "m4v", "wmv", "flv", "mov",
    "mpg", "mpeg", "ts", "m2ts", "divx", "ogm", "webm",
];

const DVD_FOLDER_NAMES: &[&str] = &["video_ts", "bdmv", "backup", "certificate"];
const DVD_EXTENSIONS: &[&str] = &["vob", "ifo", "bup", "vro"];

const SEP: &str = r"[\-_. ]";

struct ParseRegexes {
    ext: Regex,
    multipart: Regex,
    dvd59: Regex,
    sep_prefix: Regex,
    std_tags: Regex,
    multiword: Vec<Regex>,
    release_fmt: Regex,
    year_parens: Regex,
    year_brackets: Regex,
    year_sep: Regex,
    trail: Regex,
    multi_space: Regex,
}

fn get_parse_regexes() -> &'static ParseRegexes {
    static REGEXES: OnceLock<ParseRegexes> = OnceLock::new();
    REGEXES.get_or_init(|| {
        let clean_tags = [
            "ac3", "aac", "dts", "atmos", "divx", "xvid", "x264", "x265", "h264", "h265",
            "hevc", "dvdrip", "bluray", "blu-ray", "bdrip", "brrip", "bdremux", "remux",
            "dvdscr", "screener", "fullscreen", "widescreen", "telesync", "telecine",
            "hdtv", "webrip", "web-dl", "webdl", "vodrip", "hdrip",
            "480p", "576p", "720p", "1024p", "1080p", "2160p", "4k", "uhd",
            "480", "576", "720", "1024", "1080", "2160",
            "hdr", "hdr10", "10bit", "dv", "remastered", "extended", "unrated",
            "proper", "repack", "internal", "limited",
        ];
        let clean_multipart = ["part", "pt", "cd", "dvd", "disk", "disc"];
        let clean_sep_prefix = ["scr", "ts", "fs", "ws", "r5"];
        let clean_multiword = ["special edition", "directors cut", "dir cut", "director's cut"];
        let release_formats = [
            "cam", "telesync", "workprint", "telecine", "pay-per-view rip",
            "screener", "r5", "dvd-rip", "dvd-r", "hdtv", "vodrip",
            "brrip", "bdrip", "bluray", "dvd", "webdl", "webrip",
        ];

        ParseRegexes {
            ext: Regex::new(r"(?i)\.(mkv|mp4|avi|m4v|wmv|flv|mov|mpg|mpeg|ts|m2ts|divx|ogm|webm)$").unwrap(),
            multipart: Regex::new(&format!(r"(?i)(?:{})(?:{}?)[0-9a-z]", clean_multipart.join("|"), SEP)).unwrap(),
            dvd59: Regex::new(&format!(r"(?i)dvd{}?[59]", SEP)).unwrap(),
            sep_prefix: Regex::new(&format!(r"(?i)({})(?:{})(?:{}|$)", SEP, clean_sep_prefix.join("|"), SEP)).unwrap(),
            std_tags: Regex::new(&format!(r"(?i)(?:{}|\[|\()?(?:{})(?:{}|\]|\)|$)", SEP, clean_tags.join("|"), SEP)).unwrap(),
            multiword: clean_multiword.iter().map(|mw| {
                Regex::new(&format!("(?i){}", mw.replace(' ', SEP))).unwrap()
            }).collect(),
            release_fmt: Regex::new(&format!(r"(?i)(?:{}|\[|\()(?:{})(?:{}|\]|\)|$)", SEP, release_formats.join("|"), SEP)).unwrap(),
            year_parens: Regex::new(r"\(((?:19|20)\d{2})\)").unwrap(),
            year_brackets: Regex::new(r"\[((?:19|20)\d{2})\]").unwrap(),
            year_sep: Regex::new(r"[\-_. \[(]((?:19|20)\d{2})[\-_. \])]").unwrap(),
            trail: Regex::new(r"[\-_. ]+$").unwrap(),
            multi_space: Regex::new(r"\s+").unwrap(),
        }
    })
}

pub fn parse_movie_name(name: &str) -> (String, Option<i32>) {
    let re = get_parse_regexes();
    let filename = re.ext.replace(name, "").to_string();
    let filename = filename.replace('.', " ").replace('_', " ");
    let mut cut = filename.len();

    if let Some(m) = re.multipart.find(&filename) { if m.start() < cut { cut = m.start(); } }
    if let Some(m) = re.dvd59.find(&filename) { if m.start() < cut { cut = m.start(); } }
    if let Some(m) = re.sep_prefix.find(&filename) { if m.start() < cut { cut = m.start(); } }
    if let Some(m) = re.std_tags.find(&filename) { if m.start() < cut { cut = m.start(); } }
    for mw_re in &re.multiword {
        if let Some(m) = mw_re.find(&filename) { if m.start() < cut { cut = m.start(); } }
    }
    if let Some(m) = re.release_fmt.find(&filename) { if m.start() < cut { cut = m.start(); } }

    // Year detection
    let mut year: Option<i32> = None;
    let mut year_cut: Option<usize> = None;
    if let Some(m) = re.year_parens.captures(&filename) {
        year = m.get(1).and_then(|y| y.as_str().parse().ok());
        year_cut = m.get(0).map(|m| m.start());
    }
    if year.is_none() {
        if let Some(m) = re.year_brackets.captures(&filename) {
            year = m.get(1).and_then(|y| y.as_str().parse().ok());
            year_cut = m.get(0).map(|m| m.start());
        }
    }
    if year.is_none() {
        if let Some(m) = re.year_sep.captures(&filename) {
            year = m.get(1).and_then(|y| y.as_str().parse().ok());
            year_cut = m.get(0).map(|m| m.start());
        }
    }
    if let Some(yc) = year_cut { if yc < cut { cut = yc; } }

    let mut title = if cut > 0 && cut < filename.len() {
        filename[..cut].to_string()
    } else {
        filename.clone()
    };
    title = re.trail.replace(&title, "").trim().to_string();
    title = re.multi_space.replace_all(&title, " ").trim().to_string();
    if title.is_empty() { title = name.to_string(); }

    (title, year)
}

fn strip_multipart(name: &str) -> (String, Option<i32>) {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"(?i)[\s._-]*(cd|part|pt|disc|disk)[\s._-]*([0-9]+)\s*$").unwrap());
    if let Some(m) = re.captures(name) {
        let part_num: i32 = m.get(2).unwrap().as_str().parse().unwrap_or(1);
        let base = name[..m.get(0).unwrap().start()].trim().to_string();
        (base, Some(part_num))
    } else {
        (name.to_string(), None)
    }
}

fn find_companion(video_path: &str, folder: &str, extensions: &[&str]) -> Option<String> {
    let name_no_ext = Path::new(video_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    for ext in extensions {
        let by_name = Path::new(folder).join(format!("{}{}", name_no_ext, ext));
        if by_name.exists() { return Some(by_name.to_string_lossy().to_string()); }
        let generic = Path::new(folder).join(format!("movie{}", ext));
        if generic.exists() { return Some(generic.to_string_lossy().to_string()); }
    }
    None
}

fn find_image(video_path: &str, folder: &str, img_type: &str) -> Option<String> {
    let name_no_ext = Path::new(video_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    for ext in &[".jpg", ".jpeg", ".png", ".webp"] {
        let by_name = Path::new(folder).join(format!("{}-{}{}", name_no_ext, img_type, ext));
        if by_name.exists() { return Some(by_name.to_string_lossy().to_string()); }
        let generic = Path::new(folder).join(format!("{}{}", img_type, ext));
        if generic.exists() { return Some(generic.to_string_lossy().to_string()); }
    }
    None
}

pub fn probe_video(filepath: &str) -> FileInfo {
    let output = Command::new("ffprobe")
        .args(["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filepath])
        .output();
    
    let mut info = FileInfo::default();
    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => return info,
    };

    let data: serde_json::Value = match serde_json::from_slice(&output.stdout) {
        Ok(d) => d,
        Err(_) => return info,
    };

    if let Some(streams) = data.get("streams").and_then(|s| s.as_array()) {
        if let Some(vs) = streams.iter().find(|s| s.get("codec_type").and_then(|c| c.as_str()) == Some("video")) {
            let w = vs.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let h = vs.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            if w > 0 && h > 0 {
                info.resolution = format!("{}x{}", w, h);
                info.width = w;
                info.height = h;
            }
            info.video_codec = vs.get("codec_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        }
        if let Some(aus) = streams.iter().find(|s| s.get("codec_type").and_then(|c| c.as_str()) == Some("audio")) {
            info.audio_codec = aus.get("codec_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            info.audio_channels = aus.get("channels").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
        }
    }

    if let Some(fmt) = data.get("format") {
        if let Some(d) = fmt.get("duration").and_then(|v| v.as_str()).and_then(|s| s.parse::<f64>().ok()) {
            info.duration = d as u64;
        }
        if let Some(b) = fmt.get("bit_rate").and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok()) {
            info.bitrate = b;
        }
    }

    info
}

pub fn scan_directories_streaming(
    directories: &[String],
    tx: tokio::sync::mpsc::UnboundedSender<Vec<ScannedMovie>>,
) -> Vec<ScannedMovie> {
    static SAMPLE_RE: OnceLock<Vec<Regex>> = OnceLock::new();
    let sample_patterns = SAMPLE_RE.get_or_init(|| vec![
        Regex::new(r"(?i)sample").unwrap(),
        Regex::new(r"(?i)trailer").unwrap(),
        Regex::new(r"(?i)extras?[/\\]").unwrap(),
        Regex::new(r"(?i)featurettes?[/\\]").unwrap(),
    ]);

    let mut raw: Vec<(ScannedMovie, Option<i32>)> = Vec::new();
    let mut counter = 0u64;
    let mut batch: Vec<ScannedMovie> = Vec::new();

    for directory in directories {
        let dir_path = Path::new(directory);
        if !dir_path.is_dir() { continue; }

        for entry in WalkDir::new(directory)
            .into_iter()
            .filter_entry(|e| {
                if e.file_type().is_dir() {
                    let name = e.file_name().to_string_lossy().to_lowercase();
                    !DVD_FOLDER_NAMES.contains(&name.as_str())
                } else {
                    true
                }
            })
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() { continue; }
            let path = entry.path();
            let ext = path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            if DVD_EXTENSIONS.contains(&ext.as_str()) { continue; }
            if !VIDEO_EXTENSIONS.contains(&ext.as_str()) { continue; }

            let filepath = path.to_string_lossy().to_string();
            if sample_patterns.iter().any(|p| p.is_match(&filepath)) { continue; }

            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size < 50 * 1024 * 1024 { continue; }

            counter += 1;
            let fname = path.file_name().and_then(|f| f.to_str()).unwrap_or("").to_string();
            let name_no_ext = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            let folder_path = path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            let folder_name = path.parent()
                .and_then(|p| p.file_name())
                .and_then(|f| f.to_str())
                .unwrap_or("")
                .to_string();

            let (base_name, part_num) = strip_multipart(&name_no_ext);
            let parse_input = if part_num.is_some() { &base_name } else { &name_no_ext };
            let (parsed_title, parsed_year) = parse_movie_name(parse_input);

            let nfo_path = find_companion(&filepath, &folder_path, &[".nfo"]);
            let poster_path = find_image(&filepath, &folder_path, "poster")
                .filter(|p| Path::new(p).is_file());
            let fanart_path = find_image(&filepath, &folder_path, "fanart")
                .filter(|p| Path::new(p).is_file());

            let mut movie_data = None;
            let mut matched = false;
            let mut tmdb_id = None;
            let mut imdb_id = None;

            if let Some(ref np) = nfo_path {
                if let Some(data) = read_nfo(np) {
                    matched = true;
                    tmdb_id = if data.tmdb_id > 0 { Some(data.tmdb_id) } else { None };
                    imdb_id = if data.imdb_id.is_empty() { None } else { Some(data.imdb_id.clone()) };
                    movie_data = Some(data);
                }
            }

            let movie = ScannedMovie {
                id: format!("movie-{}", counter),
                file_path: filepath,
                file_name: fname,
                folder_path,
                folder_name,
                parsed_title,
                parsed_year,
                has_nfo: nfo_path.is_some(),
                has_poster: poster_path.is_some(),
                has_fanart: fanart_path.is_some(),
                nfo_path,
                poster_path,
                fanart_path,
                poster_ts: None,
                fanart_ts: None,
                matched,
                ignored: false,
                tmdb_id,
                imdb_id,
                movie_data,
                parts: vec![],
                file_size: size,
                ..Default::default()
            };

            batch.push(movie.clone());
            raw.push((movie, part_num));

            // Emit batch every 25 movies
            if batch.len() >= 25 {
                let _ = tx.send(std::mem::take(&mut batch));
            }
        }
    }

    // Send remaining batch
    if !batch.is_empty() {
        let _ = tx.send(batch);
    }

    // Group multi-part movies
    let mut movies: Vec<ScannedMovie> = Vec::new();
    let mut grouped: HashMap<(String, String, Option<i32>), usize> = HashMap::new();

    for (mut movie, part_num) in raw {
        if let Some(pn) = part_num {
            let key = (movie.folder_path.clone(), movie.parsed_title.clone(), movie.parsed_year);
            if let Some(&idx) = grouped.get(&key) {
                let primary = &mut movies[idx];
                primary.parts.push(MoviePart {
                    part_num: pn,
                    file_path: movie.file_path,
                    file_name: movie.file_name,
                });
                if !primary.has_nfo && movie.has_nfo {
                    primary.has_nfo = movie.has_nfo;
                    primary.nfo_path = movie.nfo_path;
                    primary.matched = movie.matched;
                    primary.movie_data = movie.movie_data;
                    primary.tmdb_id = movie.tmdb_id;
                    primary.imdb_id = movie.imdb_id;
                }
            } else {
                movie.parts = vec![MoviePart {
                    part_num: pn,
                    file_path: movie.file_path.clone(),
                    file_name: movie.file_name.clone(),
                }];
                let idx = movies.len();
                grouped.insert(key, idx);
                movies.push(movie);
            }
        } else {
            movies.push(movie);
        }
    }

    movies
}
