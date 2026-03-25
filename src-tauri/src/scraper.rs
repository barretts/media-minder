use reqwest::Client;
use regex::Regex;
use scraper::{Html, Selector};
use crate::types::{TmdbSearchResult, MovieData, ActorData, ImdbSearchResult, ImageEntry};
use crate::settings::load_settings;

fn tmdb_api_key() -> Result<String, String> {
    let key = load_settings().tmdb_api_key;
    if !key.is_empty() {
        return Ok(key);
    }
    std::env::var("TMDB_API_KEY").map_err(|_| \
        "TMDB API key not configured. Set tmdbApiKey in Settings or the TMDB_API_KEY environment variable.".to_string()
    )
}

const TMDB_BASE: &str = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE: &str = "https://image.tmdb.org/t/p";

fn client() -> Client {
    Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .cookie_store(true)
        .build()
        .unwrap()
}

async fn tmdb_get(client: &Client, path: &str, extra_params: &[(&str, &str)]) -> Result<serde_json::Value, String> {
    let api_key = tmdb_api_key()?;
    let mut url = format!("{}{}", TMDB_BASE, path);
    url.push_str(&format!("?api_key={}", api_key));
    for (k, v) in extra_params {
        url.push_str(&format!("&{}={}", k, v));
    }
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("TMDB API error: {}", resp.status()));
    }
    resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

fn extract_year(date_str: &str) -> i32 {
    let re = Regex::new(r"(\d{4})").unwrap();
    re.captures(date_str)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok())
        .unwrap_or(0)
}

pub async fn tmdb_search(query: &str, year: Option<i32>) -> Result<Vec<TmdbSearchResult>, String> {
    let c = client();
    let encoded_query = urlencoding::encode(query).to_string();
    let mut params = vec![("query", encoded_query.as_str()), ("language", "en-US"), ("page", "1")];
    let year_str = year.map(|y| y.to_string());
    if let Some(ref ys) = year_str {
        params.push(("year", ys.as_str()));
    }
    // Build URL manually to avoid double-encoding
    let api_key = tmdb_api_key()?;
    let mut url = format!("{}{}?api_key={}", TMDB_BASE, "/search/movie", api_key);
    url.push_str(&format!("&query={}&language=en-US&page=1", urlencoding::encode(query)));
    if let Some(y) = year {
        url.push_str(&format!("&year={}", y));
    }
    let resp = c.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    if let Some(items) = data.get("results").and_then(|r| r.as_array()) {
        for item in items {
            let release = item.get("release_date").and_then(|v| v.as_str()).unwrap_or("");
            results.push(TmdbSearchResult {
                id: item.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
                title: item.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                original_title: item.get("original_title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                year: extract_year(release),
                overview: item.get("overview").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                poster_path: item.get("poster_path").and_then(|v| v.as_str()).map(|s| s.to_string()),
                backdrop_path: item.get("backdrop_path").and_then(|v| v.as_str()).map(|s| s.to_string()),
                vote_average: item.get("vote_average").and_then(|v| v.as_f64()).unwrap_or(0.0),
                vote_count: item.get("vote_count").and_then(|v| v.as_i64()).unwrap_or(0),
                release_date: release.to_string(),
            });
        }
    }
    Ok(results)
}

pub async fn tmdb_movie_details(tmdb_id: i64) -> Result<MovieData, String> {
    let c = client();
    let data = tmdb_get(&c, &format!("/movie/{}", tmdb_id), &[
        ("append_to_response", "credits,release_dates,external_ids,images"),
    ]).await?;

    let release = data.get("release_date").and_then(|v| v.as_str()).unwrap_or("");
    let year = extract_year(release);

    let genres: Vec<String> = data.get("genres").and_then(|g| g.as_array())
        .map(|arr| arr.iter().filter_map(|g| g.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let credits = data.get("credits").cloned().unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
    let directors: Vec<String> = credits.get("crew").and_then(|c| c.as_array())
        .map(|arr| arr.iter()
            .filter(|c| c.get("job").and_then(|j| j.as_str()) == Some("Director"))
            .filter_map(|c| c.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
            .collect())
        .unwrap_or_default();

    let writers: Vec<String> = credits.get("crew").and_then(|c| c.as_array())
        .map(|arr| arr.iter()
            .filter(|c| {
                let job = c.get("job").and_then(|j| j.as_str()).unwrap_or("");
                matches!(job, "Writer" | "Screenplay" | "Story")
            })
            .filter_map(|c| c.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
            .collect())
        .unwrap_or_default();

    let actors: Vec<ActorData> = credits.get("cast").and_then(|c| c.as_array())
        .map(|arr| arr.iter().take(20).enumerate().map(|(i, c)| {
            let profile = c.get("profile_path").and_then(|p| p.as_str()).unwrap_or("");
            let thumb = if profile.is_empty() { String::new() } else { format!("{}/w185{}", TMDB_IMAGE_BASE, profile) };
            ActorData {
                name: c.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string(),
                role: c.get("character").and_then(|n| n.as_str()).unwrap_or("").to_string(),
                thumb,
                order: c.get("order").and_then(|o| o.as_i64()).unwrap_or(i as i64) as i32,
            }
        }).collect())
        .unwrap_or_default();

    let studios: Vec<String> = data.get("production_companies").and_then(|s| s.as_array())
        .map(|arr| arr.iter().filter_map(|s| s.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let countries: Vec<String> = data.get("production_countries").and_then(|s| s.as_array())
        .map(|arr| arr.iter().filter_map(|s| s.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())).collect())
        .unwrap_or_default();

    // MPAA rating
    let mut mpaa = String::new();
    if let Some(rd_results) = data.get("release_dates").and_then(|r| r.get("results")).and_then(|r| r.as_array()) {
        for rd in rd_results {
            if rd.get("iso_3166_1").and_then(|i| i.as_str()) == Some("US") {
                if let Some(dates) = rd.get("release_dates").and_then(|d| d.as_array()) {
                    for rel in dates {
                        if let Some(cert) = rel.get("certification").and_then(|c| c.as_str()) {
                            if !cert.is_empty() { mpaa = cert.to_string(); break; }
                        }
                    }
                }
            }
        }
    }

    let ext = data.get("external_ids").cloned().unwrap_or_default();
    let imdb_id = ext.get("imdb_id").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let poster_path = data.get("poster_path").and_then(|v| v.as_str()).unwrap_or("");
    let backdrop_path = data.get("backdrop_path").and_then(|v| v.as_str()).unwrap_or("");
    let poster_url = if poster_path.is_empty() { String::new() } else { format!("{}/w500{}", TMDB_IMAGE_BASE, poster_path) };
    let fanart_url = if backdrop_path.is_empty() { String::new() } else { format!("{}/original{}", TMDB_IMAGE_BASE, backdrop_path) };

    let mut trailer = String::new();
    if let Some(vids) = data.get("videos").and_then(|v| v.get("results")).and_then(|r| r.as_array()) {
        for vid in vids {
            if vid.get("type").and_then(|t| t.as_str()) == Some("Trailer")
                && vid.get("site").and_then(|s| s.as_str()) == Some("YouTube")
            {
                if let Some(key) = vid.get("key").and_then(|k| k.as_str()) {
                    trailer = format!("https://www.youtube.com/watch?v={}", key);
                    break;
                }
            }
        }
    }

    Ok(MovieData {
        title: data.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        original_title: data.get("original_title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        sort_title: data.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        set: data.get("belongs_to_collection").and_then(|c| c.get("name")).and_then(|n| n.as_str()).unwrap_or("").to_string(),
        rating: data.get("vote_average").and_then(|v| v.as_f64()).unwrap_or(0.0),
        year,
        votes: data.get("vote_count").and_then(|v| v.as_i64()).unwrap_or(0),
        outline: data.get("overview").and_then(|v| v.as_str()).unwrap_or("").chars().take(200).collect(),
        plot: data.get("overview").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        tagline: data.get("tagline").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        runtime: data.get("runtime").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
        thumb_url: poster_url.clone(),
        poster_url,
        fanart_url,
        mpaa,
        imdb_id,
        tmdb_id,
        trailer,
        genres,
        directors,
        writers,
        studios,
        countries,
        actors,
        ..Default::default()
    })
}

pub async fn tmdb_find_by_imdb(imdb_id: &str) -> Result<Option<MovieData>, String> {
    let c = client();
    let data = tmdb_get(&c, &format!("/find/{}", imdb_id), &[("external_source", "imdb_id")]).await?;
    let results = data.get("movie_results").and_then(|r| r.as_array());
    if let Some(arr) = results {
        if let Some(first) = arr.first() {
            let tid = first.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            if tid > 0 {
                let mut details = tmdb_movie_details(tid).await?;
                details.imdb_id = imdb_id.to_string();
                return Ok(Some(details));
            }
        }
    }
    Ok(None)
}

pub async fn imdb_search(query: &str, year: Option<i32>) -> Result<Vec<ImdbSearchResult>, String> {
    let c = client();
    let search_query = if let Some(y) = year { format!("{} {}", query, y) } else { query.to_string() };
    let url = format!("https://www.imdb.com/find/?q={}&s=tt&ttype=ft", urlencoding::encode(&search_query));

    let resp = c.get(&url).send().await.map_err(|e| e.to_string())?;
    let html = resp.text().await.map_err(|e| e.to_string())?;
    let document = Html::parse_document(&html);

    let item_sel = Selector::parse(".ipc-metadata-list-summary-item").unwrap();
    let link_sel = Selector::parse("a[href*='/title/']").unwrap();
    let img_sel = Selector::parse("img").unwrap();
    let re_id = Regex::new(r"(tt\d+)").unwrap();
    let re_year = Regex::new(r"\b((?:19|20)\d{2})\b").unwrap();

    let mut results = Vec::new();
    for item in document.select(&item_sel) {
        let mut imdb_id = String::new();
        let mut title = String::new();

        for link in item.select(&link_sel) {
            let href = link.value().attr("href").unwrap_or("");
            if imdb_id.is_empty() {
                if let Some(m) = re_id.captures(href) {
                    imdb_id = m.get(1).unwrap().as_str().to_string();
                }
            }
            let text: String = link.text().collect::<String>().trim().to_string();
            if title.is_empty() && !text.is_empty() {
                title = text;
            }
        }

        if imdb_id.is_empty() { continue; }

        if title.is_empty() {
            if let Some(img) = item.select(&img_sel).next() {
                let alt = img.value().attr("alt").unwrap_or("");
                let re_strip = Regex::new(r"\s*\(\d{4}\)\s*$").unwrap();
                title = re_strip.replace(alt, "").trim().to_string();
            }
        }

        let full_text: String = item.text().collect::<String>();
        let yr = re_year.captures(&full_text)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse().ok())
            .unwrap_or(0);

        let poster = item.select(&img_sel).next()
            .and_then(|img| img.value().attr("src"))
            .unwrap_or("")
            .to_string();

        results.push(ImdbSearchResult { imdb_id, title, year: yr, poster_url: poster });
    }

    Ok(results)
}

pub async fn imdb_movie_details(imdb_id: &str) -> Result<Option<MovieData>, String> {
    let c = client();
    let url = format!("https://www.imdb.com/title/{}/", imdb_id);
    let resp = c.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() { return Ok(None); }
    let html = resp.text().await.map_err(|e| e.to_string())?;
    let document = Html::parse_document(&html);

    // Find JSON-LD
    let script_sel = Selector::parse(r#"script[type="application/ld+json"]"#).unwrap();
    let script = match document.select(&script_sel).next() {
        Some(s) => s,
        None => return Ok(None),
    };

    let json_text: String = script.text().collect();
    let data: serde_json::Value = serde_json::from_str(&json_text).map_err(|e| e.to_string())?;

    let title = data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let year = data.get("datePublished").and_then(|v| v.as_str()).map(|s| extract_year(s)).unwrap_or(0);

    let rating = data.get("aggregateRating").and_then(|a| a.get("ratingValue")).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let votes = data.get("aggregateRating").and_then(|a| a.get("ratingCount")).and_then(|v| v.as_i64()).unwrap_or(0);
    let plot = data.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let genres: Vec<String> = match data.get("genre") {
        Some(serde_json::Value::Array(arr)) => arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect(),
        Some(serde_json::Value::String(s)) => vec![s.clone()],
        _ => vec![],
    };

    let directors = extract_people(&data, "director");
    let writers = extract_people_typed(&data, "creator", "Person");

    // Actors from JSON-LD
    let mut actors: Vec<ActorData> = match data.get("actor") {
        Some(serde_json::Value::Array(arr)) => arr.iter().take(20).enumerate().map(|(i, a)| {
            ActorData {
                name: a.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string(),
                role: String::new(),
                thumb: String::new(),
                order: i as i32,
            }
        }).collect(),
        _ => vec![],
    };

    // Enrich actors from HTML
    let cast_sel = Selector::parse("[data-testid='title-cast-item']").unwrap();
    let actor_sel = Selector::parse("a[data-testid='title-cast-item__actor']").unwrap();
    let char_sel = Selector::parse("[data-testid='cast-item-characters-link']").unwrap();
    for item in document.select(&cast_sel) {
        let name: String = item.select(&actor_sel).next().map(|e| e.text().collect::<String>().trim().to_string()).unwrap_or_default();
        let character: String = item.select(&char_sel).next().map(|e| e.text().collect::<String>().trim().to_string()).unwrap_or_default();
        let thumb: String = item.select(&Selector::parse("img").unwrap()).next()
            .and_then(|e| e.value().attr("src")).unwrap_or("").to_string();

        if !name.is_empty() {
            if let Some(actor) = actors.iter_mut().find(|a| a.name == name) {
                actor.role = character;
                actor.thumb = thumb;
            } else if actors.len() < 20 {
                actors.push(ActorData { name, role: character, thumb, order: actors.len() as i32 });
            }
        }
    }

    let poster_url = data.get("image").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // Runtime
    let mut runtime = 0i32;
    if let Some(dur) = data.get("duration").and_then(|v| v.as_str()) {
        let re_h = Regex::new(r"(?i)(\d+)H").unwrap();
        let re_m = Regex::new(r"(?i)(\d+)M").unwrap();
        if let Some(h) = re_h.captures(dur).and_then(|c| c.get(1)).and_then(|m| m.as_str().parse::<i32>().ok()) {
            runtime += h * 60;
        }
        if let Some(m) = re_m.captures(dur).and_then(|c| c.get(1)).and_then(|m| m.as_str().parse::<i32>().ok()) {
            runtime += m;
        }
    }

    let mpaa = data.get("contentRating").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // Tagline from HTML
    let mut tagline = String::new();
    if let Ok(sel) = Selector::parse("[data-testid='storyline-taglines']") {
        if let Some(el) = document.select(&sel).next() {
            if let Ok(li_sel) = Selector::parse("li") {
                if let Some(li) = el.select(&li_sel).next() {
                    tagline = li.text().collect::<String>().trim().to_string();
                }
            }
        }
    }

    Ok(Some(MovieData {
        title: title.clone(),
        original_title: title.clone(),
        sort_title: title,
        rating,
        year,
        votes,
        outline: plot.chars().take(200).collect(),
        plot,
        tagline,
        runtime,
        thumb_url: poster_url.clone(),
        poster_url,
        mpaa,
        imdb_id: imdb_id.to_string(),
        genres,
        directors,
        writers,
        actors,
        ..Default::default()
    }))
}

pub async fn tmdb_movie_images(tmdb_id: i64) -> Result<(Vec<ImageEntry>, Vec<ImageEntry>), String> {
    let c = client();
    let data = tmdb_get(&c, &format!("/movie/{}/images", tmdb_id), &[("include_image_language", "en,null")]).await?;

    let posters: Vec<ImageEntry> = data.get("posters").and_then(|p| p.as_array())
        .map(|arr| arr.iter().map(|p| ImageEntry {
            url: format!("{}/original{}", TMDB_IMAGE_BASE, p.get("file_path").and_then(|f| f.as_str()).unwrap_or("")),
            preview_url: format!("{}/w342{}", TMDB_IMAGE_BASE, p.get("file_path").and_then(|f| f.as_str()).unwrap_or("")),
            width: p.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            height: p.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            lang: p.get("iso_639_1").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            rating: (p.get("vote_average").and_then(|v| v.as_f64()).unwrap_or(0.0) * 100.0).round() / 100.0,
        }).collect())
        .unwrap_or_default();

    let fanarts: Vec<ImageEntry> = data.get("backdrops").and_then(|p| p.as_array())
        .map(|arr| arr.iter().map(|b| ImageEntry {
            url: format!("{}/original{}", TMDB_IMAGE_BASE, b.get("file_path").and_then(|f| f.as_str()).unwrap_or("")),
            preview_url: format!("{}/w780{}", TMDB_IMAGE_BASE, b.get("file_path").and_then(|f| f.as_str()).unwrap_or("")),
            width: b.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            height: b.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            lang: b.get("iso_639_1").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            rating: (b.get("vote_average").and_then(|v| v.as_f64()).unwrap_or(0.0) * 100.0).round() / 100.0,
        }).collect())
        .unwrap_or_default();

    Ok((posters, fanarts))
}

fn extract_people(data: &serde_json::Value, key: &str) -> Vec<String> {
    match data.get(key) {
        Some(serde_json::Value::Array(arr)) => arr.iter()
            .filter_map(|v| {
                if v.is_object() { v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()) }
                else { None }
            }).collect(),
        Some(serde_json::Value::Object(obj)) => {
            obj.get("name").and_then(|n| n.as_str()).map(|s| vec![s.to_string()]).unwrap_or_default()
        }
        _ => vec![],
    }
}

fn extract_people_typed(data: &serde_json::Value, key: &str, type_name: &str) -> Vec<String> {
    match data.get(key) {
        Some(serde_json::Value::Array(arr)) => arr.iter()
            .filter_map(|v| {
                if v.is_object() && v.get("@type").and_then(|t| t.as_str()) == Some(type_name) {
                    v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())
                } else { None }
            }).collect(),
        _ => vec![],
    }
}
