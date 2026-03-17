"""Generate Kodi-compatible NFO XML files."""

import os
import html
import xml.etree.ElementTree as ET


def escape_xml(s: str) -> str:
    if not s:
        return ""
    return html.escape(s, quote=True)


def generate_nfo(movie: dict, data: dict) -> str:
    actors_xml = "\n".join(
        f"""    <actor>
        <name>{escape_xml(a.get('name', ''))}</name>
        <role>{escape_xml(a.get('role', ''))}</role>
        <thumb>{escape_xml(a.get('thumb', ''))}</thumb>
        <order>{a.get('order', 0)}</order>
    </actor>"""
        for a in data.get("actors", [])
    )

    genres_xml = "\n".join(f"    <genre>{escape_xml(g)}</genre>" for g in data.get("genres", []))
    directors_xml = "\n".join(f"    <director>{escape_xml(d)}</director>" for d in data.get("directors", []))
    credits_xml = "\n".join(f"    <credits>{escape_xml(w)}</credits>" for w in data.get("writers", []))
    studios_xml = "\n".join(f"    <studio>{escape_xml(s)}</studio>" for s in data.get("studios", []))
    countries_xml = "\n".join(f"    <country>{escape_xml(c)}</country>" for c in data.get("countries", []))

    nfo = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
    <title>{escape_xml(data.get('title', ''))}</title>
    <originaltitle>{escape_xml(data.get('originalTitle', ''))}</originaltitle>
    <sorttitle>{escape_xml(data.get('sortTitle', ''))}</sorttitle>
    <set>{escape_xml(data.get('set', ''))}</set>
    <rating>{data.get('rating', 0):.1f}</rating>
    <year>{data.get('year', 0)}</year>
    <votes>{data.get('votes', 0)}</votes>
    <outline>{escape_xml(data.get('outline', ''))}</outline>
    <plot>{escape_xml(data.get('plot', ''))}</plot>
    <tagline>{escape_xml(data.get('tagline', ''))}</tagline>
    <runtime>{data.get('runtime', 0)}</runtime>
    <thumb>{escape_xml(data.get('thumbUrl', ''))}</thumb>
    <fanart>
        <thumb>{escape_xml(data.get('fanartUrl', ''))}</thumb>
    </fanart>
    <mpaa>{escape_xml(data.get('mpaa', ''))}</mpaa>
    <playcount>0</playcount>
    <watched>false</watched>
    <id>{escape_xml(data.get('imdbId', ''))}</id>
    <tmdbid>{data.get('tmdbId', 0)}</tmdbid>
    <uniqueid type="imdb" default="true">{escape_xml(data.get('imdbId', ''))}</uniqueid>
    <uniqueid type="tmdb">{data.get('tmdbId', 0)}</uniqueid>
    <filenameandpath>{escape_xml(movie.get('filePath', ''))}</filenameandpath>
    <trailer>{escape_xml(data.get('trailer', ''))}</trailer>
{genres_xml}
{directors_xml}
{credits_xml}
{studios_xml}
{countries_xml}
{actors_xml}
    <fileinfo>
        <streamdetails>
            <video>
                <codec>{escape_xml(str(data.get('videoCodec', '')))}</codec>
                <width>{data.get('width', 0)}</width>
                <height>{data.get('height', 0)}</height>
                <duration>{data.get('duration', 0)}</duration>
                <bitrate>{data.get('bitrate', 0)}</bitrate>
            </video>
            <audio>
                <codec>{escape_xml(str(data.get('audioCodec', '')))}</codec>
                <channels>{data.get('audioChannels', 0)}</channels>
            </audio>
        </streamdetails>
    </fileinfo>
</movie>"""
    return nfo


def read_nfo(nfo_path: str) -> dict | None:
    """Parse an existing Kodi NFO file and return movieData dict."""
    try:
        tree = ET.parse(nfo_path)
        root = tree.getroot()

        def text(tag: str, default="") -> str:
            el = root.find(tag)
            return el.text.strip() if el is not None and el.text else default

        def texts(tag: str) -> list[str]:
            return [el.text.strip() for el in root.findall(tag) if el.text]

        actors = []
        for a in root.findall("actor"):
            actors.append({
                "name": a.findtext("name", "").strip(),
                "role": a.findtext("role", "").strip(),
                "thumb": a.findtext("thumb", "").strip(),
                "order": int(a.findtext("order", "0") or 0),
            })

        fanart_url = ""
        fanart_el = root.find("fanart/thumb")
        if fanart_el is not None and fanart_el.text:
            fanart_url = fanart_el.text.strip()

        tmdb_id_raw = text("tmdbid") or text("uniqueid[@type='tmdb']")
        try:
            tmdb_id = int(tmdb_id_raw) if tmdb_id_raw else None
        except ValueError:
            tmdb_id = None

        try:
            rating = float(text("rating", "0"))
        except ValueError:
            rating = 0.0

        try:
            year = int(text("year", "0"))
        except ValueError:
            year = 0

        try:
            votes = int(text("votes", "0"))
        except ValueError:
            votes = 0

        try:
            runtime = int(text("runtime", "0"))
        except ValueError:
            runtime = 0

        # Parse <fileinfo> if present
        fileinfo = {}
        vid_el = root.find("fileinfo/streamdetails/video")
        if vid_el is not None:
            vc = (vid_el.findtext("codec") or "").strip()
            try:
                vw = int(vid_el.findtext("width", "0") or 0)
            except ValueError:
                vw = 0
            try:
                vh = int(vid_el.findtext("height", "0") or 0)
            except ValueError:
                vh = 0
            try:
                vd = int(vid_el.findtext("duration", "0") or 0)
            except ValueError:
                vd = 0
            try:
                vb = int(vid_el.findtext("bitrate", "0") or 0)
            except ValueError:
                vb = 0
            if vw or vh or vc:
                fileinfo["videoCodec"] = vc
                fileinfo["width"] = vw
                fileinfo["height"] = vh
                fileinfo["resolution"] = f"{vw}x{vh}" if vw and vh else ""
                fileinfo["duration"] = vd
                fileinfo["bitrate"] = vb
        aud_el = root.find("fileinfo/streamdetails/audio")
        if aud_el is not None:
            ac = (aud_el.findtext("codec") or "").strip()
            try:
                ach = int(aud_el.findtext("channels", "0") or 0)
            except ValueError:
                ach = 0
            if ac or ach:
                fileinfo["audioCodec"] = ac
                fileinfo["audioChannels"] = ach

        return {
            "title": text("title"),
            "originalTitle": text("originaltitle"),
            "sortTitle": text("sorttitle"),
            "set": text("set"),
            "rating": rating,
            "year": year,
            "votes": votes,
            "outline": text("outline"),
            "plot": text("plot"),
            "tagline": text("tagline"),
            "runtime": runtime,
            "mpaa": text("mpaa"),
            "imdbId": text("id") or text("uniqueid[@type='imdb']"),
            "tmdbId": tmdb_id,
            "trailer": text("trailer"),
            "genres": texts("genre"),
            "directors": texts("director"),
            "writers": texts("credits"),
            "studios": texts("studio"),
            "countries": texts("country"),
            "actors": actors,
            "posterUrl": text("thumb"),
            "fanartUrl": fanart_url,
            "thumbUrl": text("thumb"),
            "fileinfo": fileinfo if fileinfo else None,
        }
    except Exception:
        return None


def update_nfo_fileinfo(nfo_path: str, probe: dict) -> bool:
    """Insert or replace <fileinfo> in an existing NFO without rewriting movie data."""
    try:
        tree = ET.parse(nfo_path)
        root = tree.getroot()
        # Remove existing fileinfo
        for fi in root.findall("fileinfo"):
            root.remove(fi)
        # Build new fileinfo element
        fi = ET.SubElement(root, "fileinfo")
        sd = ET.SubElement(fi, "streamdetails")
        vid = ET.SubElement(sd, "video")
        ET.SubElement(vid, "codec").text = str(probe.get("videoCodec", ""))
        ET.SubElement(vid, "width").text = str(probe.get("width", 0))
        ET.SubElement(vid, "height").text = str(probe.get("height", 0))
        ET.SubElement(vid, "duration").text = str(probe.get("duration", 0))
        ET.SubElement(vid, "bitrate").text = str(probe.get("bitrate", 0))
        aud = ET.SubElement(sd, "audio")
        ET.SubElement(aud, "codec").text = str(probe.get("audioCodec", ""))
        ET.SubElement(aud, "channels").text = str(probe.get("audioChannels", 0))
        ET.indent(tree, space="    ")
        tree.write(nfo_path, encoding="unicode", xml_declaration=True)
        return True
    except Exception as e:
        print(f"Failed to update fileinfo in {nfo_path}: {e}")
        return False


def save_nfo(movie: dict, data: dict, naming: str = "filename") -> str:
    content = generate_nfo(movie, data)
    if naming == "folder":
        nfo_path = os.path.join(movie["folderPath"], "movie.nfo")
    else:
        name_no_ext = os.path.splitext(os.path.basename(movie["filePath"]))[0]
        nfo_path = os.path.join(movie["folderPath"], f"{name_no_ext}.nfo")

    with open(nfo_path, "w", encoding="utf-8") as f:
        f.write(content)
    return nfo_path
