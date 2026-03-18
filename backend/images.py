"""Download movie images (poster, fanart, actor thumbs)."""

import os
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}


def download_image(url: str, dest_path: str) -> bool:
    if not url:
        return False
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            return False
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(resp.content)
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False


def download_movie_images(movie: dict, data: dict, options: dict) -> dict:
    results = {"poster": None, "fanart": None}
    name_no_ext = os.path.splitext(os.path.basename(movie["filePath"]))[0]
    naming = options.get("namingConvention", "filename")

    if options.get("downloadPoster") and data.get("posterUrl"):
        poster_name = "poster.jpg" if naming == "folder" else f"{name_no_ext}-poster.jpg"
        poster_path = os.path.join(movie["folderPath"], poster_name)
        if download_image(data["posterUrl"], poster_path):
            results["poster"] = poster_path

    if options.get("downloadFanart") and data.get("fanartUrl"):
        fanart_name = "fanart.jpg" if naming == "folder" else f"{name_no_ext}-fanart.jpg"
        fanart_path = os.path.join(movie["folderPath"], fanart_name)
        if download_image(data["fanartUrl"], fanart_path):
            results["fanart"] = fanart_path

    if options.get("downloadActorThumbs") and data.get("actors"):
        actors_dir = os.path.join(movie["folderPath"], ".actors")
        os.makedirs(actors_dir, exist_ok=True)
        for actor in data["actors"]:
            if actor.get("thumb"):
                safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in actor["name"])
                actor_path = os.path.join(actors_dir, f"{safe_name}.jpg")
                download_image(actor["thumb"], actor_path)

    return results
