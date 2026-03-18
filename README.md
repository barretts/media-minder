# MediaMinder

Movie library manager built with [Electrobun](https://github.com/blackboardsh/electrobun) — scan folders, scrape metadata from TMDB/IMDB using headless browser (no API keys needed), and save Kodi-compatible NFO files with poster and fanart images.

## Features

- **Folder Scanning** — Point to your movie directories and find all video files
- **Headless Browser Scraping** — Scrapes TMDB and IMDB directly via Playwright (no API keys required)
- **NFO Generation** — Saves Kodi/XBMC-compatible `.nfo` files with full metadata
- **Image Downloads** — Poster, fanart, and optionally actor thumbnails
- **IMDB Match Selection** — Search and manually pick the correct TMDB/IMDB match for any movie
- **Auto-Match** — Batch-match all unmatched movies in one click
- **Modern UI** — React + Tailwind CSS dark theme

## Prerequisites

- [Bun](https://bun.sh) installed
- A Chromium browser installed (for Playwright headless scraping)

Install Playwright's Chromium browser:
```bash
npx playwright install chromium
```

## Getting Started

```bash
# Install dependencies
bun install

# Development (build + run Electrobun)
bun start

# Development with HMR (recommended)
bun run dev:hmr

# Build for production
bun run build:canary
```

## Workflow

1. Go to **Settings** and add your movie directories (e.g. `C:\Movies`, `D:\Films`)
2. Click **Save Settings**
3. Click **Scan Folders** — finds all video files > 100MB
4. Click **Auto-Match All** to batch-scrape TMDB for all movies
5. For wrong matches, click the search icon on any movie to manually search and pick the correct one
6. NFO files and images are saved automatically next to each movie file

## Architecture

```
mediaminder/
├── src/
│   ├── bun/                    # Main process (Electrobun/Bun)
│   │   ├── index.ts            # API server + window setup
│   │   ├── scanner.ts          # Directory scanning
│   │   ├── scraper.ts          # TMDB/IMDB headless browser scraping
│   │   ├── nfo.ts              # Kodi NFO XML generation
│   │   ├── images.ts           # Poster/fanart downloader
│   │   ├── settings.ts         # Settings persistence
│   │   └── types.ts            # Shared types
│   └── mainview/               # Frontend (React + Tailwind)
│       ├── App.tsx
│       ├── api.ts              # HTTP client for backend API
│       ├── types.ts
│       └── components/
│           ├── Sidebar.tsx
│           ├── MovieList.tsx
│           ├── MovieDetail.tsx
│           ├── SearchModal.tsx
│           ├── SettingsPanel.tsx
│           └── StatusBar.tsx
├── electrobun.config.ts
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
