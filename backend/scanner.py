"""Scan directories for movie files and parse titles from filenames."""

import os
import re
from pathlib import Path
from typing import Optional
from nfo import read_nfo

VIDEO_EXTENSIONS = {
    ".mkv", ".mp4", ".avi", ".m4v", ".wmv", ".flv", ".mov",
    ".mpg", ".mpeg", ".ts", ".m2ts", ".divx", ".ogm", ".webm",
}

SAMPLE_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [r"sample", r"trailer", r"extras?[/\\]", r"featurettes?[/\\]"]]

# Matches multi-part suffixes: CD1, CD2, Part1, Part 2, Disc1, Disk 2, etc.
MULTIPART_RE = re.compile(r'[\s._-]*(cd|part|pt|disc|disk)[\s._-]*([0-9]+)\s*$', re.IGNORECASE)

DVD_FOLDER_NAMES = {"video_ts", "bdmv", "backup", "certificate"}
DVD_EXTENSIONS = {".vob", ".ifo", ".bup", ".vro"}

# --- Filename cleaning (ported from Media Companion) ---

CLEAN_TAGS = [
    "ac3", "aac", "dts", "atmos", "divx", "xvid", "x264", "x265", "h264", "h265",
    "hevc", "dvdrip", "bluray", "blu-ray", "bdrip", "brrip", "bdremux", "remux",
    "dvdscr", "screener", "fullscreen", "widescreen", "telesync", "telecine",
    "hdtv", "webrip", "web-dl", "webdl", "vodrip", "hdrip",
    "480p", "576p", "720p", "1024p", "1080p", "2160p", "4k", "uhd",
    "480", "576", "720", "1024", "1080", "2160",
    "hdr", "hdr10", "10bit", "dv", "remastered", "extended", "unrated",
    "proper", "repack", "internal", "limited",
]

CLEAN_TAGS_SEP_PREFIX = ["scr", "ts", "fs", "ws", "r5"]
CLEAN_TAGS_MULTIWORD = ["special edition", "directors cut", "dir cut", "director's cut"]
CLEAN_MULTIPART = ["part", "pt", "cd", "dvd", "disk", "disc"]
RELEASE_FORMATS = [
    "cam", "telesync", "workprint", "telecine", "pay-per-view rip",
    "screener", "r5", "dvd-rip", "dvd-r", "hdtv", "vodrip",
    "brrip", "bdrip", "bluray", "dvd", "webdl", "webrip",
]

SEP = r"[\-_. ]"


def parse_movie_name(name: str) -> dict:
    """Parse a movie filename into title and year, using Media Companion's algorithm."""
    # Strip extension
    filename = re.sub(r"\.(mkv|mp4|avi|m4v|wmv|flv|mov|mpg|mpeg|ts|m2ts|divx|ogm|webm)$", "", name, flags=re.IGNORECASE)
    # Replace dots and underscores with spaces
    filename = filename.replace(".", " ").replace("_", " ")

    cut = len(filename)

    # 1: Multipart
    m = re.search(rf"(?:{'|'.join(CLEAN_MULTIPART)})(?:{SEP}?)[0-9a-z]", filename, re.IGNORECASE)
    if m and m.start() < cut:
        cut = m.start()

    # 2: DVD5/9
    m = re.search(rf"dvd{SEP}?[59]", filename, re.IGNORECASE)
    if m and m.start() < cut:
        cut = m.start()

    # 3: Sep-prefix tags
    m = re.search(rf"({SEP})(?:{'|'.join(CLEAN_TAGS_SEP_PREFIX)})(?:{SEP}|$)", filename, re.IGNORECASE)
    if m and m.start() < cut:
        cut = m.start()

    # 4: Standard tags
    m = re.search(rf"(?:{SEP}|\[|\()?(?:{'|'.join(CLEAN_TAGS)})(?:{SEP}|\]|\)|$)", filename, re.IGNORECASE)
    if m and m.start() < cut:
        cut = m.start()

    # 5: Multi-word tags
    for mw in CLEAN_TAGS_MULTIWORD:
        pattern = mw.replace(" ", SEP)
        m = re.search(pattern, filename, re.IGNORECASE)
        if m and m.start() < cut:
            cut = m.start()

    # 6: Release formats
    m = re.search(rf"(?:{SEP}|\[|\()(?:{'|'.join(RELEASE_FORMATS)})(?:{SEP}|\]|\)|$)", filename, re.IGNORECASE)
    if m and m.start() < cut:
        cut = m.start()

    # 7: Year detection (Media Companion priority)
    year = None
    year_cut = None

    # a) Year in parentheses
    ym = re.search(r"\(((?:19|20)\d{2})\)", filename)
    if ym:
        year = int(ym.group(1))
        year_cut = ym.start()

    # b) Year in brackets
    if year is None:
        ym = re.search(r"\[((?:19|20)\d{2})\]", filename)
        if ym:
            year = int(ym.group(1))
            year_cut = ym.start()

    # c) Year with separator before AND after (won't match at position 0)
    if year is None:
        ym = re.search(r"[\-_. \[(]((?:19|20)\d{2})[\-_. \])]", filename)
        if ym:
            year = int(ym.group(1))
            year_cut = ym.start()

    if year_cut is not None and year_cut < cut:
        cut = year_cut

    # Truncate
    if 0 < cut < len(filename):
        filename = filename[:cut]

    # Clean up
    filename = re.sub(r"[\-_. ]+$", "", filename).strip()
    filename = re.sub(r"\s+", " ", filename).strip()

    return {"title": filename or name, "year": year}


def _strip_multipart(name: str) -> tuple[str, int | None]:
    """Return (base_title, part_number) stripping CD1/CD2/Part1 etc."""
    m = MULTIPART_RE.search(name)
    if m:
        return name[:m.start()].strip(), int(m.group(2))
    return name, None


def scan_directories(directories: list[str]) -> list[dict]:
    """Scan directories for movie files, grouping multi-part movies."""
    raw = []
    counter = 0

    for directory in directories:
        if not os.path.isdir(directory):
            continue
        for root, dirs, files in os.walk(directory):
            # Skip DVD/BD folder structures in-place (prunes os.walk)
            dirs[:] = [d for d in dirs if d.lower() not in DVD_FOLDER_NAMES]
            # Also skip if current folder IS a DVD structure
            if os.path.basename(root).lower() in DVD_FOLDER_NAMES:
                continue
            for fname in sorted(files):  # sorted so CD1 comes before CD2
                filepath = os.path.join(root, fname)
                ext = os.path.splitext(fname)[1].lower()
                if ext in DVD_EXTENSIONS:
                    continue
                if ext not in VIDEO_EXTENSIONS:
                    continue
                if any(p.search(filepath) for p in SAMPLE_PATTERNS):
                    continue
                try:
                    size = os.path.getsize(filepath)
                except OSError:
                    continue
                if size < 50 * 1024 * 1024:
                    continue

                counter += 1
                name_no_ext = os.path.splitext(fname)[0]
                base_name, part_num = _strip_multipart(name_no_ext)
                parsed = parse_movie_name(base_name if part_num is not None else name_no_ext)
                folder_path = root
                folder_name = os.path.basename(root)

                # Check for existing companion files
                nfo_path = _find_companion(filepath, folder_path, [".nfo"])
                poster_path = _find_image(filepath, folder_path, "poster")
                fanart_path = _find_image(filepath, folder_path, "fanart")

                movie_data = None
                matched = False
                tmdb_id = None
                imdb_id = None
                if nfo_path:
                    movie_data = read_nfo(nfo_path)
                    if movie_data:
                        matched = True
                        tmdb_id = movie_data.get("tmdbId")
                        imdb_id = movie_data.get("imdbId")

                raw.append({
                    "id": f"movie-{counter}",
                    "filePath": filepath,
                    "fileName": fname,
                    "folderPath": folder_path,
                    "folderName": folder_name,
                    "parsedTitle": parsed["title"],
                    "parsedYear": parsed["year"],
                    "hasNfo": nfo_path is not None,
                    "hasPoster": poster_path is not None,
                    "hasFanart": fanart_path is not None,
                    "nfoPath": nfo_path,
                    "posterPath": poster_path,
                    "fanartPath": fanart_path,
                    "matched": matched,
                    "ignored": False,
                    "tmdbId": tmdb_id,
                    "imdbId": imdb_id,
                    "movieData": movie_data,
                    "_partNum": part_num,
                })

    # --- Group multi-part movies ---
    movies = []
    grouped: dict[tuple, dict] = {}  # (folderPath, parsedTitle, parsedYear) -> primary entry

    for m in raw:
        part_num = m.pop("_partNum", None)
        if part_num is not None:
            key = (m["folderPath"], m["parsedTitle"], m["parsedYear"])
            if key in grouped:
                # Add as additional part to existing primary entry
                primary = grouped[key]
                primary["parts"].append({"partNum": part_num, "filePath": m["filePath"], "fileName": m["fileName"]})
                # Prefer part1 companion files; fill in if primary is missing them
                if not primary["hasNfo"] and m["hasNfo"]:
                    primary["hasNfo"] = m["hasNfo"]
                    primary["nfoPath"] = m["nfoPath"]
                    primary["matched"] = m["matched"]
                    primary["movieData"] = m["movieData"]
                    primary["tmdbId"] = m["tmdbId"]
                    primary["imdbId"] = m["imdbId"]
            else:
                m["parts"] = [{"partNum": part_num, "filePath": m["filePath"], "fileName": m["fileName"]}]
                grouped[key] = m
                movies.append(m)
        else:
            m["parts"] = []
            movies.append(m)

    return movies


def _find_companion(video_path: str, folder_path: str, extensions: list[str]) -> Optional[str]:
    name_no_ext = os.path.splitext(os.path.basename(video_path))[0]
    for ext in extensions:
        by_name = os.path.join(folder_path, name_no_ext + ext)
        if os.path.exists(by_name):
            return by_name
        generic = os.path.join(folder_path, "movie" + ext)
        if os.path.exists(generic):
            return generic
    return None


def _find_image(video_path: str, folder_path: str, img_type: str) -> Optional[str]:
    name_no_ext = os.path.splitext(os.path.basename(video_path))[0]
    for ext in [".jpg", ".jpeg", ".png", ".webp"]:
        by_name = os.path.join(folder_path, f"{name_no_ext}-{img_type}{ext}")
        if os.path.exists(by_name):
            return by_name
        generic = os.path.join(folder_path, f"{img_type}{ext}")
        if os.path.exists(generic):
            return generic
    return None
