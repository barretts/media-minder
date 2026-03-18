import { writeFileSync, existsSync } from "fs";
import { join, parse } from "path";
import type { MovieData, ScannedMovie } from "./types";

export function generateNfo(movie: ScannedMovie, data: MovieData): string {
  const actors = data.actors
    .map(
      (a) => `    <actor>
        <name>${escapeXml(a.name)}</name>
        <role>${escapeXml(a.role)}</role>
        <thumb>${escapeXml(a.thumb)}</thumb>
        <order>${a.order}</order>
    </actor>`
    )
    .join("\n");

  const genres = data.genres.map((g) => `    <genre>${escapeXml(g)}</genre>`).join("\n");
  const directors = data.directors.map((d) => `    <director>${escapeXml(d)}</director>`).join("\n");
  const credits = data.writers.map((w) => `    <credits>${escapeXml(w)}</credits>`).join("\n");
  const studios = data.studios.map((s) => `    <studio>${escapeXml(s)}</studio>`).join("\n");
  const countries = data.countries.map((c) => `    <country>${escapeXml(c)}</country>`).join("\n");

  const nfo = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
    <title>${escapeXml(data.title)}</title>
    <originaltitle>${escapeXml(data.originalTitle)}</originaltitle>
    <sorttitle>${escapeXml(data.sortTitle)}</sorttitle>
    <set>${escapeXml(data.set)}</set>
    <rating>${data.rating.toFixed(1)}</rating>
    <year>${data.year}</year>
    <votes>${data.votes}</votes>
    <outline>${escapeXml(data.outline)}</outline>
    <plot>${escapeXml(data.plot)}</plot>
    <tagline>${escapeXml(data.tagline)}</tagline>
    <runtime>${data.runtime}</runtime>
    <thumb>${escapeXml(data.thumbUrl)}</thumb>
    <fanart>
        <thumb>${escapeXml(data.fanartUrl)}</thumb>
    </fanart>
    <mpaa>${escapeXml(data.mpaa)}</mpaa>
    <playcount>0</playcount>
    <watched>false</watched>
    <id>${escapeXml(data.imdbId)}</id>
    <tmdbid>${data.tmdbId}</tmdbid>
    <uniqueid type="imdb" default="true">${escapeXml(data.imdbId)}</uniqueid>
    <uniqueid type="tmdb">${data.tmdbId}</uniqueid>
    <filenameandpath>${escapeXml(movie.filePath)}</filenameandpath>
    <trailer>${escapeXml(data.trailer)}</trailer>
${genres}
${directors}
${credits}
${studios}
${countries}
${actors}
</movie>`;

  return nfo;
}

export function saveNfo(
  movie: ScannedMovie,
  data: MovieData,
  namingConvention: "folder" | "filename"
): string {
  const nfoContent = generateNfo(movie, data);
  let nfoPath: string;

  if (namingConvention === "folder") {
    nfoPath = join(movie.folderPath, "movie.nfo");
  } else {
    const nameNoExt = parse(movie.filePath).name;
    nfoPath = join(movie.folderPath, `${nameNoExt}.nfo`);
  }

  writeFileSync(nfoPath, nfoContent, "utf-8");
  return nfoPath;
}

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
