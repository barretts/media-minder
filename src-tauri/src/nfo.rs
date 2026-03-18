use std::fs;
use std::path::Path;
use crate::types::{MovieData, ActorData, ScannedMovie, FileInfo};

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub fn generate_nfo(movie: &ScannedMovie, data: &MovieData) -> String {
    let actors_xml: String = data.actors.iter().map(|a| {
        format!(
            "    <actor>\n        <name>{}</name>\n        <role>{}</role>\n        <thumb>{}</thumb>\n        <order>{}</order>\n    </actor>",
            escape_xml(&a.name), escape_xml(&a.role), escape_xml(&a.thumb), a.order
        )
    }).collect::<Vec<_>>().join("\n");

    let genres_xml: String = data.genres.iter().map(|g| format!("    <genre>{}</genre>", escape_xml(g))).collect::<Vec<_>>().join("\n");
    let directors_xml: String = data.directors.iter().map(|d| format!("    <director>{}</director>", escape_xml(d))).collect::<Vec<_>>().join("\n");
    let credits_xml: String = data.writers.iter().map(|w| format!("    <credits>{}</credits>", escape_xml(w))).collect::<Vec<_>>().join("\n");
    let studios_xml: String = data.studios.iter().map(|s| format!("    <studio>{}</studio>", escape_xml(s))).collect::<Vec<_>>().join("\n");
    let countries_xml: String = data.countries.iter().map(|c| format!("    <country>{}</country>", escape_xml(c))).collect::<Vec<_>>().join("\n");

    format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
    <title>{title}</title>
    <originaltitle>{original_title}</originaltitle>
    <sorttitle>{sort_title}</sorttitle>
    <set>{set}</set>
    <rating>{rating:.1}</rating>
    <year>{year}</year>
    <votes>{votes}</votes>
    <outline>{outline}</outline>
    <plot>{plot}</plot>
    <tagline>{tagline}</tagline>
    <runtime>{runtime}</runtime>
    <thumb>{thumb_url}</thumb>
    <fanart>
        <thumb>{fanart_url}</thumb>
    </fanart>
    <mpaa>{mpaa}</mpaa>
    <playcount>0</playcount>
    <watched>false</watched>
    <id>{imdb_id}</id>
    <tmdbid>{tmdb_id}</tmdbid>
    <uniqueid type="imdb" default="true">{imdb_id}</uniqueid>
    <uniqueid type="tmdb">{tmdb_id}</uniqueid>
    <filenameandpath>{file_path}</filenameandpath>
    <trailer>{trailer}</trailer>
{genres}
{directors}
{credits}
{studios}
{countries}
{actors}
    <fileinfo>
        <streamdetails>
            <video>
                <codec>{video_codec}</codec>
                <width>{width}</width>
                <height>{height}</height>
                <duration>{duration}</duration>
                <bitrate>{bitrate}</bitrate>
            </video>
            <audio>
                <codec>{audio_codec}</codec>
                <channels>{audio_channels}</channels>
            </audio>
        </streamdetails>
    </fileinfo>
</movie>"#,
        title = escape_xml(&data.title),
        original_title = escape_xml(&data.original_title),
        sort_title = escape_xml(&data.sort_title),
        set = escape_xml(&data.set),
        rating = data.rating,
        year = data.year,
        votes = data.votes,
        outline = escape_xml(&data.outline),
        plot = escape_xml(&data.plot),
        tagline = escape_xml(&data.tagline),
        runtime = data.runtime,
        thumb_url = escape_xml(&data.thumb_url),
        fanart_url = escape_xml(&data.fanart_url),
        mpaa = escape_xml(&data.mpaa),
        imdb_id = escape_xml(&data.imdb_id),
        tmdb_id = data.tmdb_id,
        file_path = escape_xml(&movie.file_path),
        trailer = escape_xml(&data.trailer),
        genres = genres_xml,
        directors = directors_xml,
        credits = credits_xml,
        studios = studios_xml,
        countries = countries_xml,
        actors = actors_xml,
        video_codec = escape_xml(&data.video_codec),
        width = data.width,
        height = data.height,
        duration = data.duration,
        bitrate = data.bitrate,
        audio_codec = escape_xml(&data.audio_codec),
        audio_channels = data.audio_channels,
    )
}

pub fn read_nfo(nfo_path: &str) -> Option<MovieData> {
    let content = fs::read_to_string(nfo_path).ok()?;

    // Fast string-based XML tag extraction (no regex compilation)
    fn tag_text(content: &str, tag: &str) -> String {
        let open = format!("<{}>", tag);
        let close_tag = tag.split_whitespace().next().unwrap_or(tag);
        let close = format!("</{}>", close_tag);
        if let Some(start) = content.find(&open) {
            let after = start + open.len();
            if let Some(end) = content[after..].find(&close) {
                return content[after..after + end].trim().to_string();
            }
        }
        String::new()
    }

    fn tag_texts(content: &str, tag: &str) -> Vec<String> {
        let open = format!("<{}>", tag);
        let close = format!("</{}>", tag);
        let mut results = Vec::new();
        let mut search_from = 0;
        while let Some(start) = content[search_from..].find(&open) {
            let abs_start = search_from + start + open.len();
            if let Some(end) = content[abs_start..].find(&close) {
                let val = content[abs_start..abs_start + end].trim().to_string();
                if !val.is_empty() { results.push(val); }
                search_from = abs_start + end + close.len();
            } else {
                break;
            }
        }
        results
    }

    fn extract_block<'a>(content: &'a str, tag: &str) -> &'a str {
        let open = format!("<{}>", tag);
        let close = format!("</{}>", tag);
        if let Some(start) = content.find(&open) {
            let after = start + open.len();
            if let Some(end) = content[after..].find(&close) {
                return &content[after..after + end];
            }
        }
        ""
    }

    let title = tag_text(&content, "title");
    if title.is_empty() { return None; }

    let tmdb_id_str = {
        let t = tag_text(&content, "tmdbid");
        if t.is_empty() { tag_text(&content, r#"uniqueid type="tmdb""#) } else { t }
    };
    let tmdb_id: i64 = tmdb_id_str.parse().unwrap_or(0);
    let imdb_id = {
        let i = tag_text(&content, "id");
        if i.is_empty() { tag_text(&content, r#"uniqueid type="imdb" default="true""#) } else { i }
    };

    // Parse actors
    let mut actors: Vec<ActorData> = Vec::new();
    let mut actor_search = 0;
    while let Some(start) = content[actor_search..].find("<actor>") {
        let abs_start = actor_search + start + 7;
        if let Some(end) = content[abs_start..].find("</actor>") {
            let block = &content[abs_start..abs_start + end];
            actors.push(ActorData {
                name: tag_text(block, "name"),
                role: tag_text(block, "role"),
                thumb: tag_text(block, "thumb"),
                order: tag_text(block, "order").parse().unwrap_or(0),
            });
            actor_search = abs_start + end + 8;
        } else {
            break;
        }
    }

    // Parse fanart
    let fanart_block = extract_block(&content, "fanart");
    let fanart_url = if !fanart_block.is_empty() {
        tag_text(fanart_block, "thumb")
    } else {
        String::new()
    };

    // Parse fileinfo
    let mut fileinfo: Option<FileInfo> = None;
    let fi_block = extract_block(&content, "fileinfo");
    if !fi_block.is_empty() {
        let video_block = extract_block(fi_block, "video");
        let audio_block = extract_block(fi_block, "audio");
        let vc = tag_text(video_block, "codec");
        let w: u32 = tag_text(video_block, "width").parse().unwrap_or(0);
        let h: u32 = tag_text(video_block, "height").parse().unwrap_or(0);
        if w > 0 || h > 0 || !vc.is_empty() {
            fileinfo = Some(FileInfo {
                video_codec: tag_text(video_block, "codec"),
                width: w,
                height: h,
                resolution: if w > 0 && h > 0 { format!("{}x{}", w, h) } else { String::new() },
                duration: tag_text(video_block, "duration").parse().unwrap_or(0),
                bitrate: tag_text(video_block, "bitrate").parse().unwrap_or(0),
                audio_codec: tag_text(audio_block, "codec"),
                audio_channels: tag_text(audio_block, "channels").parse().unwrap_or(0),
            });
        }
    }

    Some(MovieData {
        title,
        original_title: tag_text(&content, "originaltitle"),
        sort_title: tag_text(&content, "sorttitle"),
        set: tag_text(&content, "set"),
        rating: tag_text(&content, "rating").parse().unwrap_or(0.0),
        year: tag_text(&content, "year").parse().unwrap_or(0),
        votes: tag_text(&content, "votes").parse().unwrap_or(0),
        outline: tag_text(&content, "outline"),
        plot: tag_text(&content, "plot"),
        tagline: tag_text(&content, "tagline"),
        runtime: tag_text(&content, "runtime").parse().unwrap_or(0),
        mpaa: tag_text(&content, "mpaa"),
        imdb_id,
        tmdb_id,
        trailer: tag_text(&content, "trailer"),
        genres: tag_texts(&content, "genre"),
        directors: tag_texts(&content, "director"),
        writers: tag_texts(&content, "credits"),
        studios: tag_texts(&content, "studio"),
        countries: tag_texts(&content, "country"),
        actors,
        poster_url: tag_text(&content, "thumb"),
        fanart_url,
        thumb_url: tag_text(&content, "thumb"),
        fileinfo,
        ..Default::default()
    })
}

pub fn save_nfo(movie: &ScannedMovie, data: &MovieData, naming: &str) -> Result<String, String> {
    let content = generate_nfo(movie, data);
    let nfo_path = if naming == "folder" {
        Path::new(&movie.folder_path).join("movie.nfo")
    } else {
        let name_no_ext = Path::new(&movie.file_path)
            .file_stem().and_then(|s| s.to_str()).unwrap_or("movie");
        Path::new(&movie.folder_path).join(format!("{}.nfo", name_no_ext))
    };
    fs::write(&nfo_path, content).map_err(|e| e.to_string())?;
    Ok(nfo_path.to_string_lossy().to_string())
}

pub fn update_nfo_fileinfo(nfo_path: &str, probe: &FileInfo) -> Result<(), String> {
    let content = fs::read_to_string(nfo_path).map_err(|e| e.to_string())?;
    // Remove existing fileinfo
    let re = regex::Regex::new(r"(?s)\s*<fileinfo>.*?</fileinfo>").unwrap();
    let content = re.replace(&content, "").to_string();
    // Insert before </movie>
    let new_fi = format!(r#"
    <fileinfo>
        <streamdetails>
            <video>
                <codec>{}</codec>
                <width>{}</width>
                <height>{}</height>
                <duration>{}</duration>
                <bitrate>{}</bitrate>
            </video>
            <audio>
                <codec>{}</codec>
                <channels>{}</channels>
            </audio>
        </streamdetails>
    </fileinfo>"#,
        escape_xml(&probe.video_codec), probe.width, probe.height, probe.duration, probe.bitrate,
        escape_xml(&probe.audio_codec), probe.audio_channels,
    );
    let content = content.replace("</movie>", &format!("{}\n</movie>", new_fi));
    fs::write(nfo_path, content).map_err(|e| e.to_string())?;
    Ok(())
}
