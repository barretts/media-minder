"""MediaMinder desktop launcher — starts FastAPI backend + pywebview window."""

import sys
import os
import threading
import time

# When running as a PyInstaller bundle, _MEIPASS points to the temp extract dir.
# In dev, use the project root.
if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Add backend/ to sys.path so server.py imports work
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

PORT = 3457
URL = f"http://localhost:{PORT}"


def start_server():
    """Run the FastAPI server in a background thread."""
    import uvicorn
    from server import app
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")


def wait_for_server(timeout=10):
    """Block until the server responds or timeout."""
    import urllib.request
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(f"{URL}/api/settings", timeout=1)
            return True
        except Exception:
            time.sleep(0.2)
    return False


def main():
    # Start FastAPI in a daemon thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    if not wait_for_server():
        print("ERROR: Server failed to start within 10 seconds.")
        sys.exit(1)

    print(f"Server running at {URL}")

    # Open native window
    import webview
    window = webview.create_window(
        "MediaMinder",
        URL,
        width=1280,
        height=900,
        min_size=(800, 600),
    )
    webview.start()


if __name__ == "__main__":
    main()
