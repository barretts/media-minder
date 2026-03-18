# MediaMinder — Packaging as a Standalone EXE

## Current Architecture
- **Python backend** (FastAPI on port 3457) — scraping, NFO generation, image downloads
- **React frontend** (Vite build) — served either by Vite dev server or bundled into Electrobun
- **Electrobun** — desktop window shell (Chromium-based, uses Bun runtime)

The challenge: bundling a Python runtime + a JS/Chromium desktop shell into a single distributable.

---

## Option 1: PyInstaller + Embedded Frontend (Simplest)

Drop Electrobun entirely. Bundle everything into a single Python EXE.

**How it works:**
1. Build the React frontend (`npx vite build` → `dist/`)
2. Have FastAPI serve the static `dist/` files at `/` in addition to the API routes
3. Use **PyInstaller** to bundle Python + FastAPI + the built frontend into one EXE
4. On launch, the EXE starts the server and opens the default browser to `http://localhost:3457`

**Pros:**
- Single EXE, no extra runtimes needed
- Simple build pipeline
- Works on Windows, macOS, Linux

**Cons:**
- Opens in browser, not a native-feeling window
- EXE size ~30-50MB (Python runtime + dependencies)
- Cold start ~2-3 seconds

**Steps:**
```
pip install pyinstaller
# Add static file serving to server.py
# pyinstaller --onefile --add-data "dist;dist" backend/server.py
```

---

## Option 2: PyInstaller + System Tray + Browser Launch

Same as Option 1, but with a system tray icon for a more polished feel.

**How it works:**
1. Bundle frontend into FastAPI (same as Option 1)
2. Add **pystray** for a system tray icon with menu (Open, Settings, Quit)
3. Auto-open browser on launch via `webbrowser.open()`
4. PyInstaller bundles it all

**Pros:**
- Feels more like a native app (tray icon, clean quit)
- Still a single EXE
- User can close browser tab and reopen from tray

**Cons:**
- Still runs in browser, not a dedicated window

---

## Option 3: PyWebView + PyInstaller (Native Window, No Browser)

Replace Electrobun with **pywebview** — a Python library that opens a native OS webview window.

**How it works:**
1. Build React frontend into `dist/`
2. FastAPI serves the API on a background thread
3. **pywebview** opens a native window pointing at `http://localhost:3457`
4. PyInstaller bundles everything into one EXE

**Pros:**
- **True native window** — no browser chrome, title bar only
- Single EXE
- No Node/Bun/Electrobun dependency at all
- Lightweight (~15-30MB)

**Cons:**
- WebView rendering varies by OS (Edge WebView2 on Windows, WebKit on macOS)
- Slightly less feature-rich than Electron/Electrobun

**Example launcher code:**
```python
import webview
import threading
import uvicorn
from server import app

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=3457)

if __name__ == "__main__":
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    webview.create_window("MediaMinder", "http://localhost:3457", width=1280, height=900)
    webview.start()
```

---

## Option 4: Electron + Embedded Python (Heavier but Polished)

Replace Electrobun with **Electron**, embed Python via PyInstaller.

**How it works:**
1. PyInstaller builds the Python backend into an EXE
2. Electron main process spawns the Python EXE as a child process
3. Electron renderer loads the React frontend
4. Use **electron-builder** to package into a single installer/EXE

**Pros:**
- Most polished desktop experience
- Full control over window, menus, native integrations
- Large ecosystem and community

**Cons:**
- Heaviest option (~100-150MB)
- Two runtimes (Node + Python)
- More complex build pipeline

---

## Option 5: Keep Electrobun, Bundle Python

Keep the current Electrobun shell but embed a frozen Python backend.

**How it works:**
1. PyInstaller builds `backend/` into a standalone EXE (`mediaminder-api.exe`)
2. Electrobun's Bun entry point spawns `mediaminder-api.exe` as a child process
3. Electrobun build packages everything together

**Pros:**
- Keeps current architecture mostly intact
- Electrobun is lighter than Electron

**Cons:**
- Electrobun is newer/less mature, especially on Windows
- Two runtimes bundled
- More complex child process management

---

## Recommendation

| Criteria | Option 1 | Option 2 | Option 3 | Option 4 | Option 5 |
|---|---|---|---|---|---|
| Single EXE | ✅ | ✅ | ✅ | ❌ (installer) | ❌ (installer) |
| Native window | ❌ | ❌ | ✅ | ✅ | ✅ |
| Bundle size | ~40MB | ~40MB | ~30MB | ~150MB | ~100MB |
| Build complexity | Low | Low | Low | High | Medium |
| No extra runtimes | ✅ | ✅ | ✅ | ❌ | ❌ |

### **Best bet: Option 3 (PyWebView + PyInstaller)**

It gives you a native desktop window, a single EXE, minimal dependencies, and keeps the entire stack in Python. The migration path is straightforward:

1. `pip install pywebview pyinstaller`
2. Add static file serving to FastAPI (`dist/` folder)
3. Create a `launcher.py` that starts FastAPI + opens pywebview
4. `pyinstaller --onefile --windowed launcher.py`
5. Done — one `.exe`, native window, no browser, no Node

### Runner-up: Option 1 if you don't care about the browser chrome

Fastest to implement — just add static serving and run PyInstaller. Users open it like a web app.
