"""Settings management."""

import os
import json
from pathlib import Path

CONFIG_DIR = os.path.join(Path.home(), ".mediaminder")
CONFIG_FILE = os.path.join(CONFIG_DIR, "settings.json")

DEFAULT_SETTINGS = {
    "movieDirectories": ["G:\\movies"],
    "namingConvention": "filename",
    "downloadPoster": True,
    "downloadFanart": True,
    "downloadActorThumbs": False,
    "autoSaveNfo": True,
    "autoSaveImages": True,
    "language": "en-US",
    "ignoredPaths": [],
    "cleanupStrings": [],
}


def load_settings() -> dict:
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
            return {**DEFAULT_SETTINGS, **saved}
    except Exception:
        pass
    return dict(DEFAULT_SETTINGS)


def save_settings(settings: dict):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)
