import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, parse } from "path";
import type { ScannedMovie, MovieData } from "./types";

export async function downloadImage(url: string, destPath: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = await res.arrayBuffer();
    const dir = parse(destPath).dir;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(destPath, Buffer.from(buffer));
    return true;
  } catch (e) {
    console.error(`Failed to download image from ${url}:`, e);
    return false;
  }
}

export async function downloadMovieImages(
  movie: ScannedMovie,
  data: MovieData,
  options: {
    namingConvention: "folder" | "filename";
    downloadPoster: boolean;
    downloadFanart: boolean;
    downloadActorThumbs: boolean;
  }
): Promise<{ poster: string | null; fanart: string | null }> {
  const results: { poster: string | null; fanart: string | null } = {
    poster: null,
    fanart: null,
  };

  const nameNoExt = parse(movie.filePath).name;

  if (options.downloadPoster && data.posterUrl) {
    const posterName =
      options.namingConvention === "folder"
        ? "poster.jpg"
        : `${nameNoExt}-poster.jpg`;
    const posterPath = join(movie.folderPath, posterName);
    if (await downloadImage(data.posterUrl, posterPath)) {
      results.poster = posterPath;
    }
  }

  if (options.downloadFanart && data.fanartUrl) {
    const fanartName =
      options.namingConvention === "folder"
        ? "fanart.jpg"
        : `${nameNoExt}-fanart.jpg`;
    const fanartPath = join(movie.folderPath, fanartName);
    if (await downloadImage(data.fanartUrl, fanartPath)) {
      results.fanart = fanartPath;
    }
  }

  if (options.downloadActorThumbs && data.actors.length > 0) {
    const actorsDir = join(movie.folderPath, ".actors");
    if (!existsSync(actorsDir)) mkdirSync(actorsDir, { recursive: true });
    for (const actor of data.actors) {
      if (actor.thumb) {
        const actorFile = join(actorsDir, `${sanitizeFilename(actor.name)}.jpg`);
        await downloadImage(actor.thumb, actorFile);
      }
    }
  }

  return results;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}
