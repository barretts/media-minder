# MediaMinder

Movie library manager built with [Tauri](https://tauri.app) — scan folders, scrape metadata from TMDB, and save Kodi-compatible NFO files with poster and fanart images.

## Features

- **Folder Scanning** — Point to your movie directories and find all video files
- **TMDB Scraping** — Fetches metadata, cast, ratings, and images via the TMDB API
- **NFO Generation** — Saves Kodi/XBMC-compatible `.nfo` files with full metadata
- **Image Downloads** — Poster, fanart, and optionally actor thumbnails
- **Match Selection** — Search and manually pick the correct TMDB match for any movie
- **Auto-Match** — Batch-match all unmatched movies in one click
- **Duplicates View** — Detect and manage duplicate entries across your library
- **Modern UI** — React + Tailwind CSS dark theme

## Prerequisites

- [Rust](https://rustup.rs) (stable toolchain)
- [Node.js](https://nodejs.org) and npm
- A [TMDB API key](https://www.themoviedb.org/settings/api) (free)

## Getting Started

```bash
# Install JS dependencies
npm install

# Development (Tauri dev server with HMR)
npm run tauri dev

# Build for production
npm run tauri build
```

## TMDB API Key

MediaMinder requires a TMDB API key to fetch movie metadata.

Get a free key at: https://www.themoviedb.org/settings/api

You can provide it in either of two ways (settings file takes priority):

**Option 1 — Settings UI (recommended):**
Open the app, go to **Settings**, and enter your key in the **TMDB API Key** field.
It is saved to `~/.mediaminder/settings.json` and never committed to source control.

**Option 2 — Environment variable:**
```bash
# Windows (PowerShell)
$env:TMDB_API_KEY = "your_key_here"
npm run tauri dev

# macOS / Linux
TMDB_API_KEY=your_key_here npm run tauri dev
```

## Workflow

1. Go to **Settings**, add your movie directories (e.g. `C:\Movies`), and enter your TMDB API key
2. Click **Save Settings**
3. Click **Scan Folders** — finds all video files > 100MB
4. Click **Auto-Match All** to batch-scrape TMDB for all movies
5. For wrong matches, click the search icon on any movie to manually search and pick the correct one
6. NFO files and images are saved automatically next to each movie file

## Architecture

```
mediaminder/
├── src-tauri/                  # Tauri + Rust backend
│   ├── src/
│   │   ├── commands.rs         # Tauri IPC command handlers
│   │   ├── scanner.rs          # Directory scanning
│   │   ├── scraper.rs          # TMDB API scraping
│   │   ├── nfo.rs              # Kodi NFO XML generation
│   │   ├── images.rs           # Poster/fanart downloader
│   │   ├── settings.rs         # Settings persistence (~/.mediaminder/)
│   │   └── types.rs            # Shared types
│   └── tauri.conf.json
├── src/
│   └── mainview/               # Frontend (React + Tailwind)
│       ├── App.tsx
│       ├── api.ts              # Tauri invoke() wrappers
│       ├── types.ts
│       └── components/
│           ├── Sidebar.tsx
│           ├── MovieList.tsx
│           ├── MovieDetail.tsx
│           ├── SearchModal.tsx
│           ├── SettingsPanel.tsx
│           ├── DuplicatesView.tsx
│           ├── ImagePickerModal.tsx
│           └── StatusBar.tsx
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## NFO Format

Generates Kodi-compatible XML:
```xml
<movie>
    <title>Movie Title</title>
    <originaltitle>Original Title</originaltitle>
    <rating>7.5</rating>
    <year>2024</year>
    <plot>Full plot description</plot>
    <id>tt1234567</id>
    <genre>Action</genre>
    <director>Director Name</director>
    <actor>
        <name>Actor Name</name>
        <role>Character</role>
        <thumb>url</thumb>
    </actor>
</movie>
```

## File Naming

Two conventions supported (configurable in Settings):

- **Folder-based**: `movie.nfo`, `poster.jpg`, `fanart.jpg`
- **Filename-based**: `MovieName.nfo`, `MovieName-poster.jpg`, `MovieName-fanart.jpg`
