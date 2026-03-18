"""FastAPI backend for MediaMinder."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import traceback

from settings import load_settings, save_settings
from scanner import scan_directories
from scraper import tmdb_search, tmdb_movie_details, tmdb_find_by_imdb, imdb_search, imdb_movie_details, _tmdb_get, TMDB_IMAGE_BASE, SESSION
from nfo import save_nfo
from images import download_movie_images

app = FastAPI(title="MediaMinder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state
settings = load_settings()
movies: list[dict] = []


# --- Models ---

class SettingsUpdate(BaseModel):
    movieDirectories: Optional[list[str]] = None
    namingConvention: Optional[str] = None
    downloadPoster: Optional[bool] = None
    downloadFanart: Optional[bool] = None
    downloadActorThumbs: Optional[bool] = None
    autoSaveNfo: Optional[bool] = None
    autoSaveImages: Optional[bool] = None
    language: Optional[str] = None
    cleanupStrings: Optional[list[str]] = None

class SearchRequest(BaseModel):
    query: str
    year: Optional[int] = None

class MovieDetailsRequest(BaseModel):
    tmdbId: int

class MatchRequest(BaseModel):
    movieId: str
    tmdbId: int

class MovieIdRequest(BaseModel):
    movieId: str

class ImdbSearchRequest(BaseModel):
    query: str
    year: Optional[int] = None

class ImdbMatchRequest(BaseModel):
    movieId: str
    imdbId: str

class IgnoreRequest(BaseModel):
    movieId: str
    ignored: bool = True


# --- Routes ---

@app.get("/api/settings")
def get_settings():
    return settings


@app.post("/api/settings")
def update_settings(body: SettingsUpdate):
    global settings
    update = {k: v for k, v in body.dict().items() if v is not None or isinstance(v, list)}
    settings = {**settings, **update}
    save_settings(settings)
    return {"ok": True}


@app.post("/api/scan")
def scan():
    global movies
    movies = scan_directories(settings["movieDirectories"])
    # Restore ignored flag for previously ignored paths
    ignored_paths = set(settings.get("ignoredPaths", []))
    for m in movies:
        if m["filePath"] in ignored_paths:
            m["ignored"] = True
    return {"movies": movies, "total": len(movies)}


@app.get("/api/movies")
def get_movies():
    return {"movies": movies}


@app.post("/api/search")
def search(body: SearchRequest):
    try:
        results = tmdb_search(body.query, body.year)
        return {"results": results}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/movie-details")
def movie_details(body: MovieDetailsRequest):
    try:
        data = tmdb_movie_details(body.tmdbId)
        if not data:
            raise HTTPException(status_code=500, detail="Failed to scrape movie details")
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/match")
def match_movie(body: MatchRequest):
    idx = next((i for i, m in enumerate(movies) if m["id"] == body.movieId), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Movie not found")

    try:
        data = tmdb_movie_details(body.tmdbId)
        if not data:
            raise HTTPException(status_code=500, detail="Failed to scrape details")
        movies[idx] = {
            **movies[idx],
            "matched": True,
            "tmdbId": data.get("tmdbId"),
            "imdbId": data.get("imdbId"),
            "movieData": data,
        }
        return {"movie": movies[idx]}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process")
def process_movie(body: MatchRequest):
    idx = next((i for i, m in enumerate(movies) if m["id"] == body.movieId), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Movie not found")

    try:
        data = tmdb_movie_details(body.tmdbId)
        if not data:
            raise HTTPException(status_code=500, detail="Failed to scrape details")

        movies[idx] = {
            **movies[idx],
            "matched": True,
            "tmdbId": data.get("tmdbId"),
            "imdbId": data.get("imdbId"),
            "movieData": data,
        }

        if settings.get("autoSaveNfo", True):
            nfo_path = save_nfo(movies[idx], data, settings.get("namingConvention", "filename"))
            movies[idx]["hasNfo"] = True
            movies[idx]["nfoPath"] = nfo_path

        if settings.get("autoSaveImages", True):
            img_result = download_movie_images(movies[idx], data, {
                "namingConvention": settings.get("namingConvention", "filename"),
                "downloadPoster": settings.get("downloadPoster", True),
                "downloadFanart": settings.get("downloadFanart", True),
                "downloadActorThumbs": settings.get("downloadActorThumbs", False),
            })

            if img_result.get("poster"):
                movies[idx]["hasPoster"] = True
                movies[idx]["posterPath"] = img_result["poster"]
            if img_result.get("fanart"):
                movies[idx]["hasFanart"] = True
                movies[idx]["fanartPath"] = img_result["fanart"]

        return {"movie": movies[idx]}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/save-nfo")
def save_nfo_endpoint(body: MovieIdRequest):
    movie = next((m for m in movies if m["id"] == body.movieId), None)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    if not movie.get("movieData"):
        raise HTTPException(status_code=400, detail="Movie not matched yet")

    nfo_path = save_nfo(movie, movie["movieData"], settings.get("namingConvention", "filename"))
    movie["hasNfo"] = True
    movie["nfoPath"] = nfo_path
    return {"nfoPath": nfo_path}


@app.post("/api/download-images")
def download_images_endpoint(body: MovieIdRequest):
    movie = next((m for m in movies if m["id"] == body.movieId), None)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    if not movie.get("movieData"):
        raise HTTPException(status_code=400, detail="Movie not matched yet")

    result = download_movie_images(movie, movie["movieData"], {
        "namingConvention": settings.get("namingConvention", "filename"),
        "downloadPoster": settings.get("downloadPoster", True),
        "downloadFanart": settings.get("downloadFanart", True),
        "downloadActorThumbs": settings.get("downloadActorThumbs", False),
    })

    if result.get("poster"):
        movie["hasPoster"] = True
        movie["posterPath"] = result["poster"]
    if result.get("fanart"):
        movie["hasFanart"] = True
        movie["fanartPath"] = result["fanart"]

    return {"result": result}


def _apply_match(idx: int, data: dict):
    """Apply matched movie data to movies[idx] and auto-save NFO/images."""
    movies[idx] = {
        **movies[idx],
        "matched": True,
        "tmdbId": data.get("tmdbId"),
        "imdbId": data.get("imdbId"),
        "movieData": data,
    }
    if settings.get("autoSaveNfo", True):
        nfo_path = save_nfo(movies[idx], data, settings.get("namingConvention", "filename"))
        movies[idx]["hasNfo"] = True
        movies[idx]["nfoPath"] = nfo_path
    if settings.get("autoSaveImages", True):
        img_result = download_movie_images(movies[idx], data, {
            "namingConvention": settings.get("namingConvention", "filename"),
            "downloadPoster": settings.get("downloadPoster", True),
            "downloadFanart": settings.get("downloadFanart", True),
            "downloadActorThumbs": settings.get("downloadActorThumbs", False),
        })
        if img_result.get("poster"):
            movies[idx]["hasPoster"] = True
            movies[idx]["posterPath"] = img_result["poster"]
        if img_result.get("fanart"):
            movies[idx]["hasFanart"] = True
            movies[idx]["fanartPath"] = img_result["fanart"]


@app.post("/api/auto-match")
def auto_match():
    unmatched = [m for m in movies if not m.get("matched") and not m.get("hasNfo") and not m.get("ignored")]
    results = []

    for movie in unmatched:
        idx = next(i for i, m in enumerate(movies) if m["id"] == movie["id"])
        try:
            # Apply cleanup strings to title before searching
            search_title = movie["parsedTitle"]
            for s in settings.get("cleanupStrings", []):
                search_title = search_title.replace(s, "").strip()
            search_title = search_title.strip(" -_.,")

            # --- Try TMDB first ---
            data = None
            source = None
            search_results = tmdb_search(search_title, movie.get("parsedYear"))
            if search_results:
                data = tmdb_movie_details(search_results[0]["id"])
                if data:
                    source = "tmdb"

            # --- Fallback to IMDB if TMDB gave nothing ---
            if not data:
                print(f"[auto-match] TMDB miss for '{search_title}', trying IMDB...")
                imdb_results = imdb_search(search_title, movie.get("parsedYear"))
                if imdb_results:
                    data = imdb_movie_details(imdb_results[0]["imdbId"])
                    if data:
                        source = "imdb"

            if not data:
                results.append({"movieId": movie["id"], "success": False, "error": "No results on TMDB or IMDB"})
                continue

            _apply_match(idx, data)
            results.append({"movieId": movie["id"], "success": True, "source": source})
        except Exception as e:
            traceback.print_exc()
            results.append({"movieId": movie["id"], "success": False, "error": str(e)})

    return {"results": results, "movies": movies}


# ---- Unset endpoint ----

@app.post("/api/unset-movie")
def unset_movie(body: MovieIdRequest):
    """Delete NFO/poster/fanart files and reset movie to unmatched state."""
    movie = next((m for m in movies if m["id"] == body.movieId), None)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    deleted = []
    for field in ("nfoPath", "posterPath", "fanartPath"):
        path = movie.get(field)
        if path and os.path.isfile(path):
            try:
                os.remove(path)
                deleted.append(path)
            except Exception as e:
                print(f"Could not delete {path}: {e}")
    movie["matched"] = False
    movie["movieData"] = None
    movie["tmdbId"] = None
    movie["imdbId"] = None
    movie["hasNfo"] = False
    movie["nfoPath"] = None
    movie["hasPoster"] = False
    movie["posterPath"] = None
    movie["hasFanart"] = False
    movie["fanartPath"] = None
    return {"movie": movie, "deleted": deleted}


# ---- Ignore endpoint ----

@app.post("/api/ignore")
def ignore_movie(body: IgnoreRequest):
    movie = next((m for m in movies if m["id"] == body.movieId), None)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    movie["ignored"] = body.ignored
    # Persist to settings so future scans remember
    ignored_paths = set(settings.get("ignoredPaths", []))
    if body.ignored:
        ignored_paths.add(movie["filePath"])
    else:
        ignored_paths.discard(movie["filePath"])
    settings["ignoredPaths"] = list(ignored_paths)
    save_settings(settings)
    return {"movie": movie}


# ---- IMDB endpoints ----

@app.post("/api/imdb-search")
def imdb_search_endpoint(body: ImdbSearchRequest):
    try:
        results = imdb_search(body.query, body.year)
        return {"results": results}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/imdb-details")
def imdb_details_endpoint(body: BaseModel):
    """Get details for a specific IMDB ID."""
    import json
    raw = json.loads(body.json()) if hasattr(body, 'json') else {}
    # Use raw request body instead
    return {"error": "Use /api/imdb-process instead"}


@app.post("/api/imdb-process")
def imdb_process(body: ImdbMatchRequest):
    """Match a movie using IMDB data, save NFO + images."""
    idx = next((i for i, m in enumerate(movies) if m["id"] == body.movieId), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Movie not found")

    try:
        # Try TMDB lookup via IMDB ID first (reliable API), fall back to IMDB scraping
        data = tmdb_find_by_imdb(body.imdbId)
        if not data:
            data = imdb_movie_details(body.imdbId)
        if not data:
            raise HTTPException(status_code=500, detail="Failed to fetch movie details")

        movies[idx] = {
            **movies[idx],
            "matched": True,
            "tmdbId": data.get("tmdbId"),
            "imdbId": data.get("imdbId"),
            "movieData": data,
        }

        if settings.get("autoSaveNfo", True):
            nfo_path = save_nfo(movies[idx], data, settings.get("namingConvention", "filename"))
            movies[idx]["hasNfo"] = True
            movies[idx]["nfoPath"] = nfo_path

        if settings.get("autoSaveImages", True):
            img_result = download_movie_images(movies[idx], data, {
                "namingConvention": settings.get("namingConvention", "filename"),
                "downloadPoster": settings.get("downloadPoster", True),
                "downloadFanart": settings.get("downloadFanart", True),
                "downloadActorThumbs": settings.get("downloadActorThumbs", False),
            })

            if img_result.get("poster"):
                movies[idx]["hasPoster"] = True
                movies[idx]["posterPath"] = img_result["poster"]
            if img_result.get("fanart"):
                movies[idx]["hasFanart"] = True
                movies[idx]["fanartPath"] = img_result["fanart"]

        return {"movie": movies[idx]}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class ImageSelectRequest(BaseModel):
    movieId: str
    imageUrl: str
    imageType: str  # "poster" or "fanart"


@app.post("/api/movie-images")
def get_movie_images(body: MovieIdRequest):
    """Return all available poster and fanart images for a matched movie, with dimensions."""
    movie = next((m for m in movies if m["id"] == body.movieId), None)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    data = movie.get("movieData")
    if not data:
        raise HTTPException(status_code=400, detail="Movie not matched yet")

    posters = []
    fanarts = []

    tmdb_id = data.get("tmdbId")
    if tmdb_id:
        try:
            img_data = _tmdb_get(f"/movie/{tmdb_id}/images", {"include_image_language": "en,null"})
            for p in img_data.get("posters", []):
                posters.append({
                    "url": f"{TMDB_IMAGE_BASE}/original{p['file_path']}",
                    "previewUrl": f"{TMDB_IMAGE_BASE}/w342{p['file_path']}",
                    "width": p.get("width", 0),
                    "height": p.get("height", 0),
                    "lang": p.get("iso_639_1", ""),
                    "rating": round(p.get("vote_average", 0), 2),
                })
            for b in img_data.get("backdrops", []):
                fanarts.append({
                    "url": f"{TMDB_IMAGE_BASE}/original{b['file_path']}",
                    "previewUrl": f"{TMDB_IMAGE_BASE}/w780{b['file_path']}",
                    "width": b.get("width", 0),
                    "height": b.get("height", 0),
                    "lang": b.get("iso_639_1", ""),
                    "rating": round(b.get("vote_average", 0), 2),
                })
        except Exception as e:
            print(f"Failed to fetch TMDB images: {e}")

    # Fallback: include current poster/fanart urls if no TMDB images
    if not posters and data.get("posterUrl"):
        posters.append({"url": data["posterUrl"], "previewUrl": data["posterUrl"], "width": 0, "height": 0, "lang": "en", "rating": 0})
    if not fanarts and data.get("fanartUrl"):
        fanarts.append({"url": data["fanartUrl"], "previewUrl": data["fanartUrl"], "width": 0, "height": 0, "lang": "", "rating": 0})

    return {"posters": posters, "fanarts": fanarts}


@app.post("/api/save-image")
def save_image(body: ImageSelectRequest):
    """Download a specific image URL and save as poster or fanart for a movie."""
    movie = next((m for m in movies if m["id"] == body.movieId), None)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    naming = settings.get("namingConvention", "filename")
    name_no_ext = os.path.splitext(os.path.basename(movie["filePath"]))[0]
    folder = movie["folderPath"]

    if body.imageType == "poster":
        dest = os.path.join(folder, f"{name_no_ext}-poster.jpg")
    elif body.imageType == "fanart":
        dest = os.path.join(folder, f"{name_no_ext}-fanart.jpg")
    else:
        raise HTTPException(status_code=400, detail="imageType must be 'poster' or 'fanart'")

    try:
        resp = SESSION.get(body.imageUrl, timeout=30, stream=True)
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        ts = int(os.path.getmtime(dest) * 1000)
        if body.imageType == "poster":
            movie["hasPoster"] = True
            movie["posterPath"] = dest
            movie["posterTs"] = ts
        else:
            movie["hasFanart"] = True
            movie["fanartPath"] = dest
            movie["fanartTs"] = ts
        return {"movie": movie, "savedPath": dest}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/probe-all")
def probe_all():
    """Run ffprobe on all non-ignored movies that have NFOs but no cached fileinfo. Updates NFOs in place."""
    from scanner import _probe_video
    from nfo import update_nfo_fileinfo
    probed = 0
    skipped = 0
    failed = 0
    for m in movies:
        if m.get("ignored"):
            skipped += 1
            continue
        # Already has cached fileinfo?
        cached = (m.get("movieData") or {}).get("fileinfo")
        if cached and cached.get("width"):
            skipped += 1
            continue
        probe = _probe_video(m["filePath"])
        if not probe.get("width"):
            failed += 1
            continue
        # Update in-memory movieData
        if m.get("movieData"):
            m["movieData"]["fileinfo"] = probe
            m["movieData"]["videoCodec"] = probe.get("videoCodec", "")
            m["movieData"]["audioCodec"] = probe.get("audioCodec", "")
            m["movieData"]["audioChannels"] = probe.get("audioChannels", 0)
            m["movieData"]["width"] = probe.get("width", 0)
            m["movieData"]["height"] = probe.get("height", 0)
            m["movieData"]["duration"] = probe.get("duration", 0)
            m["movieData"]["bitrate"] = probe.get("bitrate", 0)
        # Write to NFO if it exists
        nfo_path = m.get("nfoPath")
        if nfo_path and os.path.isfile(nfo_path):
            update_nfo_fileinfo(nfo_path, probe)
        probed += 1
    return {"probed": probed, "skipped": skipped, "failed": failed}


class DeleteFileRequest(BaseModel):
    movieId: str


@app.post("/api/delete-movie-file")
def delete_movie_file(body: DeleteFileRequest):
    """Delete a movie's video file and its companion files (NFO, poster, fanart). Removes from in-memory list."""
    global movies
    idx = next((i for i, m in enumerate(movies) if m["id"] == body.movieId), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    movie = movies[idx]
    deleted = []
    # Delete the video file
    if os.path.isfile(movie["filePath"]):
        try:
            os.remove(movie["filePath"])
            deleted.append(movie["filePath"])
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete video: {e}")
    # Delete companion files
    for field in ("nfoPath", "posterPath", "fanartPath"):
        path = movie.get(field)
        if path and os.path.isfile(path):
            try:
                os.remove(path)
                deleted.append(path)
            except Exception as e:
                print(f"Could not delete {path}: {e}")
    # Remove from in-memory list
    movies.pop(idx)
    return {"deleted": deleted, "movieId": body.movieId}


@app.get("/api/duplicates")
def get_duplicates():
    """Find movies with duplicate parsed titles, using cached fileinfo or ffprobe on-demand."""
    from collections import defaultdict
    from scanner import _probe_video
    title_groups = defaultdict(list)
    display_titles = {}  # keep original-cased title for display
    for m in movies:
        key = (m["parsedTitle"].lower().strip(), m.get("parsedYear"))
        title_groups[key].append(m)
        if key not in display_titles:
            display_titles[key] = m.get("movieData", {}).get("title") if m.get("movieData") else None
        if not display_titles[key]:
            display_titles[key] = m["parsedTitle"]
    dupes = {}
    for k, group in title_groups.items():
        if len(group) < 2:
            continue
        enriched = []
        for m in group:
            # Check for cached fileinfo from NFO first
            cached = (m.get("movieData") or {}).get("fileinfo")
            if cached and cached.get("width"):
                info = cached
            else:
                info = _probe_video(m["filePath"])
            enriched.append({**m, **{
                "resolution": info.get("resolution", ""),
                "width": info.get("width", 0),
                "height": info.get("height", 0),
                "videoCodec": info.get("videoCodec", ""),
                "audioCodec": info.get("audioCodec", ""),
                "audioChannels": info.get("audioChannels", 0),
                "duration": info.get("duration", 0),
                "bitrate": info.get("bitrate", 0),
            }})
        title = display_titles.get(k) or k[0]
        dupes[f"{title} ({k[1] or '?'})"] = enriched
    return {"groups": dupes, "totalDuplicates": sum(len(v) for v in dupes.values())}


@app.get("/api/file")
def serve_file(path: str = Query(...)):
    """Serve a local file (e.g. poster/fanart image) by absolute path."""
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


# Serve built frontend from dist/ if it exists (for packaged app)
import sys as _sys
_base = getattr(_sys, "_MEIPASS", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_dist_dir = os.path.join(_base, "dist")
if os.path.isdir(_dist_dir):
    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(_dist_dir, "index.html"))

    app.mount("/assets", StaticFiles(directory=os.path.join(_dist_dir, "assets")), name="static-assets")


if __name__ == "__main__":
    import uvicorn
    print("Starting MediaMinder API on http://localhost:3457")
    uvicorn.run(app, host="0.0.0.0", port=3457, log_level="info")
