# Tauri v2 + Rust Migration Plan

Replace the Python FastAPI backend + PyWebView/PyInstaller packaging with a Tauri v2 desktop app powered by a Rust backend. The existing React/Vite frontend stays, with `api.ts` fetch calls swapped for Tauri `invoke()` commands.

---

## Architecture Change

| | Before | After |
|---|---|---|
| Backend | Python FastAPI (HTTP on :3457) | Rust via Tauri commands (IPC, no HTTP) |
| Frontend | React/Vite (same) | React/Vite (same, HMR via `tauri dev`) |
| Packaging | PyInstaller + pywebview | `tauri build` → MSI/NSIS installer |
| Shell | pywebview (Edge WebView2) | Tauri (Edge WebView2) |
| Bundle size | ~37MB EXE | ~5-10MB installer |

## What Gets Deleted
- `backend/` (all Python: server.py, scraper.py, scanner.py, nfo.py, images.py, settings.py)
- `launcher.py`, `build.ps1`, `MediaMinder.spec`
- `src/bun/` (unused Electrobun code)
- `electrobun.config.ts`, `start.ps1`, `stop.ps1`, `start-desktop.ps1`
- PyInstaller artifacts (`release/`, `build/pyinstaller/`)

## What Stays (unchanged)
- `src/mainview/components/` — all React components (Sidebar, MovieList, MovieDetail, SearchModal, ImagePickerModal, SettingsPanel, DuplicatesView, StatusBar)
- `src/mainview/types.ts` — TypeScript interfaces
- `src/mainview/index.css` — Solaris 8 theme CSS
- `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`

## What Gets Modified
- `src/mainview/api.ts` — replace `fetch("http://localhost:3457/...")` with `invoke("command_name", { args })`
- `src/mainview/App.tsx` — minor: image URLs via `convertFileSrc()` instead of `/api/file?path=`
- `src/mainview/components/MovieDetail.tsx` — image src changes
- `src/mainview/components/DuplicatesView.tsx` — image src changes
- `package.json` — add `@tauri-apps/api`, `@tauri-apps/cli`, remove electrobun/pywebview deps
- `vite.config.ts` — point at Tauri dev server

---

## Implementation Steps

### Phase 1: Scaffold Tauri v2 into the project
1. Run `npm create tauri-app` (or manually init) inside the existing project
2. This creates `src-tauri/` with `Cargo.toml`, `tauri.conf.json`, `src/main.rs`
3. Configure `tauri.conf.json` to point at Vite dev server (port 5173) for dev, and `../dist` for build
4. Add `@tauri-apps/api` and `@tauri-apps/cli` to `package.json`
5. Update `vite.config.ts` for Tauri compatibility
6. Verify `tauri dev` launches the existing React UI in a native window with HMR

### Phase 2: Port settings.py → Rust
- `src-tauri/src/settings.rs`
- Read/write `~/.mediaminder/settings.json` using `serde_json`
- Tauri commands: `get_settings`, `save_settings`
- ~50 lines of Rust

### Phase 3: Port scanner.py → Rust
- `src-tauri/src/scanner.rs`
- Directory walking with `walkdir` crate
- Filename parsing with `regex` (port the Media Companion algorithm)
- ffprobe integration via `std::process::Command`
- NFO companion file detection
- Tauri commands: `scan`, `probe_all`
- ~300 lines of Rust

### Phase 4: Port scraper.py → Rust
- `src-tauri/src/scraper.rs`
- TMDB API v3 calls via `reqwest` + `serde_json`
- IMDB HTML scraping via `scraper` crate (CSS selectors, like BeautifulSoup)
- JSON-LD parsing from IMDB pages
- Tauri commands: `tmdb_search`, `tmdb_movie_details`, `tmdb_find_by_imdb`, `imdb_search`, `imdb_movie_details`
- ~350 lines of Rust

### Phase 5: Port nfo.py → Rust
- `src-tauri/src/nfo.rs`
- Kodi-compatible XML generation with `quick-xml`
- NFO reading/parsing (existing files)
- `update_nfo_fileinfo` for ffprobe data
- Tauri commands: `save_nfo`, `read_nfo`
- ~250 lines of Rust

### Phase 6: Port images.py → Rust
- `src-tauri/src/images.rs`
- Image downloading via `reqwest`
- Tauri commands: `download_images`, `save_image`
- ~60 lines of Rust

### Phase 7: Port server.py API logic → Rust (in-memory state + orchestration)
- `src-tauri/src/state.rs` — `AppState` with `Mutex<Vec<Movie>>` for in-memory movie list
- `src-tauri/src/commands.rs` — all Tauri commands that wire together the modules
- Port all 18 endpoints as Tauri commands:
  - `get_settings`, `save_settings`
  - `scan`, `get_movies`
  - `search`, `movie_details`, `match_movie`, `process_movie`, `auto_match`
  - `save_nfo`, `download_images`
  - `ignore_movie`, `unset_movie`
  - `imdb_search`, `imdb_process`
  - `get_movie_images`, `save_image_selection`
  - `get_duplicates`, `delete_movie_file`, `probe_all`
- Tauri `manage()` for shared state

### Phase 8: Rewire the frontend
- `api.ts`: Replace all `fetch()` calls with `invoke()` from `@tauri-apps/api/core`
- Image serving: Use `convertFileSrc()` from `@tauri-apps/api/core` for local file URLs (posters, fanart) instead of `/api/file?path=`
- Update any component that references `http://localhost:3457` 
- Update `DuplicatesView.tsx` (has hardcoded `const API = "http://localhost:3457"`)

### Phase 9: Build & test
- `tauri dev` — verify HMR, all features work
- `tauri build` — produces MSI installer
- Test: scan, auto-match, manual search (TMDB + IMDB), save NFO, download images, duplicates, settings, ignore/unset

### Phase 10: Cleanup
- Delete `backend/`, `launcher.py`, `build.ps1`, `MediaMinder.spec`
- Delete `src/bun/`, `electrobun.config.ts`, `start*.ps1`, `stop.ps1`
- Delete `release/`, `build/` directories
- Update `.gitignore` for Tauri (target/, etc.)
- Update `README.md`

---

## Rust Crates (Cargo.toml)

| Crate | Purpose | Replaces |
|---|---|---|
| `tauri` v2 | Desktop framework + IPC | FastAPI + pywebview |
| `reqwest` | HTTP client (TMDB API, IMDB scraping, image downloads) | Python `requests` |
| `scraper` | HTML/CSS selector parsing | `beautifulsoup4` |
| `serde` + `serde_json` | JSON serialization | Python `json` |
| `quick-xml` | XML read/write for NFO files | `xml.etree.ElementTree` |
| `walkdir` | Recursive directory traversal | `os.walk` |
| `regex` | Filename parsing | Python `re` |
| `tokio` | Async runtime | Python threading |

## Dev Experience
- **HMR**: `tauri dev` runs Vite on :5173 with hot reload. Edit React → instant refresh. Edit Rust → auto-recompile (~3s).
- **Debugging**: Rust backend logs to terminal. Frontend uses Chrome DevTools (F12 in Tauri window).
- **Build**: `tauri build` produces `target/release/bundle/` with MSI/NSIS installer.

## Estimated Effort
- Phase 1 (scaffold): ~15 min
- Phases 2-6 (port modules): ~2-3 hours (mostly mechanical translation)
- Phase 7 (state + commands): ~1 hour  
- Phase 8 (rewire frontend): ~30 min
- Phase 9-10 (test + cleanup): ~30 min
