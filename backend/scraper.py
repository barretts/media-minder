"""TMDB + IMDB data fetching using TMDB API v3 + IMDB scraping."""

import re
import json
import requests
from bs4 import BeautifulSoup
from typing import Optional

TMDB_API_KEY = "827ba7bdd2eb1db3c4f566828964af80"
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def _tmdb_get(path: str, params: dict = None) -> dict:
    """Make a TMDB API v3 request."""
    params = params or {}
    params["api_key"] = TMDB_API_KEY
    resp = SESSION.get(f"{TMDB_BASE}{path}", params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


# ---- TMDB API ----

def tmdb_search(query: str, year: Optional[int] = None) -> list[dict]:
    """Search TMDB for movies."""
    params = {"query": query, "language": "en-US", "page": 1}
    if year:
        params["year"] = year
    data = _tmdb_get("/search/movie", params)

    results = []
    for item in data.get("results", []):
        release = item.get("release_date", "")
        yr = 0
        if release:
            ym = re.search(r"(\d{4})", release)
            if ym:
                yr = int(ym.group(1))

        results.append({
            "id": item["id"],
            "title": item.get("title", ""),
            "originalTitle": item.get("original_title", ""),
            "year": yr,
            "overview": item.get("overview", ""),
            "posterPath": item.get("poster_path"),
            "backdropPath": item.get("backdrop_path"),
            "voteAverage": item.get("vote_average", 0),
            "voteCount": item.get("vote_count", 0),
            "releaseDate": release,
        })

    return results


def tmdb_movie_details(tmdb_id: int) -> Optional[dict]:
    """Get full movie details from TMDB API."""
    try:
        # Get movie details with credits and release dates appended
        data = _tmdb_get(f"/movie/{tmdb_id}", {"append_to_response": "credits,release_dates,external_ids,images"})
    except Exception as e:
        print(f"Failed to get TMDB details for {tmdb_id}: {e}")
        return None

    release = data.get("release_date", "")
    year = 0
    if release:
        ym = re.search(r"(\d{4})", release)
        if ym:
            year = int(ym.group(1))

    # Genres
    genres = [g["name"] for g in data.get("genres", [])]

    # Credits
    credits = data.get("credits", {})
    directors = [c["name"] for c in credits.get("crew", []) if c.get("job") == "Director"]
    writers = [c["name"] for c in credits.get("crew", []) if c.get("job") in ("Writer", "Screenplay", "Story")]
    actors = []
    for i, c in enumerate(credits.get("cast", [])[:20]):
        thumb = f"{TMDB_IMAGE_BASE}/w185{c['profile_path']}" if c.get("profile_path") else ""
        actors.append({
            "name": c.get("name", ""),
            "role": c.get("character", ""),
            "thumb": thumb,
            "order": c.get("order", i),
        })

    # Studios
    studios = [s["name"] for s in data.get("production_companies", [])]
    countries = [c["name"] for c in data.get("production_countries", [])]

    # MPAA rating
    mpaa = ""
    for rd in data.get("release_dates", {}).get("results", []):
        if rd.get("iso_3166_1") == "US":
            for rel in rd.get("release_dates", []):
                cert = rel.get("certification", "")
                if cert:
                    mpaa = cert
                    break

    # External IDs
    ext = data.get("external_ids", {})
    imdb_id = ext.get("imdb_id", "") or ""

    # Images
    poster_path = data.get("poster_path", "")
    backdrop_path = data.get("backdrop_path", "")
    poster_url = f"{TMDB_IMAGE_BASE}/w500{poster_path}" if poster_path else ""
    fanart_url = f"{TMDB_IMAGE_BASE}/original{backdrop_path}" if backdrop_path else ""

    # Trailer
    trailer = ""
    for vid in data.get("videos", {}).get("results", []):
        if vid.get("type") == "Trailer" and vid.get("site") == "YouTube":
            trailer = f"https://www.youtube.com/watch?v={vid['key']}"
            break

    return {
        "title": data.get("title", ""),
        "originalTitle": data.get("original_title", ""),
        "sortTitle": data.get("title", ""),
        "set": data.get("belongs_to_collection", {}).get("name", "") if data.get("belongs_to_collection") else "",
        "rating": data.get("vote_average", 0),
        "year": year,
        "votes": data.get("vote_count", 0),
        "outline": (data.get("overview", "") or "")[:200],
        "plot": data.get("overview", ""),
        "tagline": data.get("tagline", ""),
        "runtime": data.get("runtime", 0) or 0,
        "thumbUrl": poster_url,
        "posterUrl": poster_url,
        "fanartUrl": fanart_url,
        "mpaa": mpaa,
        "imdbId": imdb_id,
        "tmdbId": tmdb_id,
        "trailer": trailer,
        "genres": genres,
        "directors": directors,
        "writers": writers,
        "studios": studios,
        "countries": countries,
        "actors": actors,
    }


def tmdb_find_by_imdb(imdb_id: str) -> Optional[dict]:
    """Look up a movie on TMDB using its IMDB ID, then return full details."""
    try:
        data = _tmdb_get(f"/find/{imdb_id}", {"external_source": "imdb_id"})
        results = data.get("movie_results", [])
        if not results:
            return None
        tmdb_id = results[0]["id"]
        details = tmdb_movie_details(tmdb_id)
        if details:
            details["imdbId"] = imdb_id
        return details
    except Exception as e:
        print(f"TMDB find by IMDB ID failed for {imdb_id}: {e}")
        return None


# ---- IMDB Scraping ----

def imdb_search(query: str, year: Optional[int] = None) -> list[dict]:
    """Search IMDB for movies."""
    search_query = f"{query} {year}" if year else query
    url = f"https://www.imdb.com/find/?q={requests.utils.quote(search_query)}&s=tt&ttype=ft"
    try:
        resp = SESSION.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        results = []
        for item in soup.select(".ipc-metadata-list-summary-item"):
            # Find all title links — pick the one with actual text
            imdb_id = ""
            title = ""
            for link in item.select("a[href*='/title/']"):
                href = link.get("href", "")
                id_match = re.search(r"(tt\d+)", href)
                if id_match and not imdb_id:
                    imdb_id = id_match.group(1)
                text = link.get_text(strip=True)
                if text and not title:
                    title = text

            if not imdb_id:
                continue

            # Fallback: get title from img alt
            if not title:
                img = item.select_one("img")
                if img:
                    alt = img.get("alt", "")
                    # "Dinosaur Valley Girls (1996)" -> "Dinosaur Valley Girls"
                    title = re.sub(r"\s*\(\d{4}\)\s*$", "", alt).strip()

            yr = 0
            # Extract year from full text or spans
            full_text = item.get_text(" ", strip=True)
            ym = re.search(r"\b((?:19|20)\d{2})\b", full_text)
            if ym:
                yr = int(ym.group(1))

            # Poster thumbnail
            img = item.select_one("img")
            poster = img.get("src", "") if img else ""

            results.append({
                "imdbId": imdb_id,
                "title": title,
                "year": yr,
                "posterUrl": poster,
            })

        return results
    except Exception as e:
        print(f"IMDB search error: {e}")
        import traceback; traceback.print_exc()
        return []


def imdb_movie_details(imdb_id: str) -> Optional[dict]:
    """Scrape full movie details from IMDB page using JSON-LD + HTML parsing.
    Returns data in the same format as tmdb_movie_details for compatibility."""
    url = f"https://www.imdb.com/title/{imdb_id}/"
    try:
        resp = SESSION.get(url, timeout=15)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "lxml")

        # Primary source: JSON-LD structured data
        script = soup.select_one('script[type="application/ld+json"]')
        if not script:
            return None

        data = json.loads(script.string)

        title = data.get("name", "")
        year = 0
        if data.get("datePublished"):
            ym = re.search(r"(\d{4})", data["datePublished"])
            if ym:
                year = int(ym.group(1))

        rating = 0.0
        votes = 0
        agg = data.get("aggregateRating", {})
        if agg:
            rating = float(agg.get("ratingValue", 0))
            votes = int(agg.get("ratingCount", 0))

        plot = data.get("description", "")

        # Genres
        genres_raw = data.get("genre", [])
        genres = genres_raw if isinstance(genres_raw, list) else [genres_raw] if genres_raw else []

        # Directors
        dir_raw = data.get("director", [])
        if not isinstance(dir_raw, list):
            dir_raw = [dir_raw] if dir_raw else []
        directors = [d.get("name", "") for d in dir_raw if isinstance(d, dict)]

        # Writers/creators
        creator_raw = data.get("creator", [])
        if not isinstance(creator_raw, list):
            creator_raw = [creator_raw] if creator_raw else []
        writers = [c.get("name", "") for c in creator_raw if isinstance(c, dict) and c.get("@type") == "Person"]

        # Actors from JSON-LD
        actor_raw = data.get("actor", [])
        if not isinstance(actor_raw, list):
            actor_raw = [actor_raw] if actor_raw else []
        actors = []
        for i, a in enumerate(actor_raw[:20]):
            if isinstance(a, dict):
                actors.append({
                    "name": a.get("name", ""),
                    "role": "",
                    "thumb": "",
                    "order": i,
                })

        # Try to get character names from the page HTML
        for cast_item in soup.select("[data-testid='title-cast-item']"):
            name_el = cast_item.select_one("a[data-testid='title-cast-item__actor']")
            char_el = cast_item.select_one("[data-testid='cast-item-characters-link']") or cast_item.select_one(".character")
            img_el = cast_item.select_one("img")
            if name_el:
                name = name_el.get_text(strip=True)
                char = char_el.get_text(strip=True) if char_el else ""
                thumb = img_el.get("src", "") if img_el else ""
                # Update existing actor or add new
                found = False
                for actor in actors:
                    if actor["name"] == name:
                        actor["role"] = char
                        actor["thumb"] = thumb
                        found = True
                        break
                if not found and len(actors) < 20:
                    actors.append({"name": name, "role": char, "thumb": thumb, "order": len(actors)})

        # Poster
        poster_url = data.get("image", "")

        # Runtime from JSON-LD
        duration = data.get("duration", "")
        runtime = 0
        if duration:
            h = re.search(r"(\d+)H", duration, re.IGNORECASE)
            m = re.search(r"(\d+)M", duration, re.IGNORECASE)
            if h:
                runtime += int(h.group(1)) * 60
            if m:
                runtime += int(m.group(1))

        # MPAA/content rating
        mpaa = ""
        content_rating = data.get("contentRating", "")
        if content_rating:
            mpaa = content_rating

        # Keywords as tagline fallback
        tagline = ""
        tagline_el = soup.select_one("[data-testid='storyline-taglines']")
        if tagline_el:
            tag_text = tagline_el.select_one("li")
            if tag_text:
                tagline = tag_text.get_text(strip=True)

        return {
            "title": title,
            "originalTitle": title,
            "sortTitle": title,
            "set": "",
            "rating": rating,
            "year": year,
            "votes": votes,
            "outline": plot[:200] if plot else "",
            "plot": plot,
            "tagline": tagline,
            "runtime": runtime,
            "thumbUrl": poster_url,
            "posterUrl": poster_url,
            "fanartUrl": "",
            "mpaa": mpaa,
            "imdbId": imdb_id,
            "tmdbId": 0,
            "trailer": "",
            "genres": genres,
            "directors": directors,
            "writers": writers,
            "studios": [],
            "countries": [],
            "actors": actors,
        }
    except Exception as e:
        print(f"IMDB details error for {imdb_id}: {e}")
        import traceback; traceback.print_exc()
        return None
