import { readdirSync, statSync, existsSync } from "fs";
import { join, extname, basename, dirname, parse } from "path";
import type { ScannedMovie } from "./types";

const VIDEO_EXTENSIONS = new Set([
  ".mkv", ".mp4", ".avi", ".m4v", ".wmv", ".flv", ".mov",
  ".mpg", ".mpeg", ".ts", ".m2ts", ".divx", ".ogm", ".webm",
]);

const SAMPLE_PATTERNS = [/sample/i, /trailer/i, /extras?[/\\]/i, /featurettes?[/\\]/i];

export function scanDirectories(directories: string[]): ScannedMovie[] {
  const movies: ScannedMovie[] = [];
  let idCounter = 0;

  for (const dir of directories) {
    if (!existsSync(dir)) continue;
    const found = findMovieFiles(dir);
    for (const filePath of found) {
      idCounter++;
      const movie = analyzeMovieFile(filePath, `movie-${idCounter}`);
      movies.push(movie);
    }
  }

  return movies;
}

function findMovieFiles(directory: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else if (stat.isFile()) {
            const ext = extname(entry).toLowerCase();
            if (VIDEO_EXTENSIONS.has(ext) && !isSampleFile(fullPath) && stat.size > 50 * 1024 * 1024) {
              files.push(fullPath);
            }
          }
        } catch {
          // skip inaccessible files
        }
      }
    } catch {
      // skip inaccessible directories
    }
  }

  walk(directory);
  return files;
}

function isSampleFile(filePath: string): boolean {
  return SAMPLE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function analyzeMovieFile(filePath: string, id: string): ScannedMovie {
  const fileName = basename(filePath);
  const folderPath = dirname(filePath);
  const folderName = basename(folderPath);
  const { title, year } = parseMovieName(parse(fileName).name);

  const nfoPath = findCompanionFile(filePath, [".nfo"]);
  const posterPath = findImageFile(filePath, folderPath, "poster");
  const fanartPath = findImageFile(filePath, folderPath, "fanart");

  return {
    id,
    filePath,
    fileName,
    folderPath,
    folderName,
    parsedTitle: title,
    parsedYear: year,
    hasNfo: nfoPath !== null,
    hasPoster: posterPath !== null,
    hasFanart: fanartPath !== null,
    nfoPath,
    posterPath,
    fanartPath,
    matched: false,
    tmdbId: null,
    imdbId: null,
    movieData: null,
  };
}

// --- Filename cleaning ported from Media Companion's Utilities.CleanFileName ---

const CLEAN_SEPARATORS = "-_. ";
const SEP_REGEX_CLASS = `[\\-_. ]`;

// Tags that don't need a separator before them (case-insensitive)
const CLEAN_TAGS = [
  "ac3", "aac", "dts", "atmos", "divx", "xvid", "x264", "x265", "h264", "h265",
  "hevc", "dvdrip", "bluray", "blu-ray", "bdrip", "brrip", "bdremux", "remux",
  "dvdscr", "screener", "fullscreen", "widescreen", "telesync", "telecine",
  "hdtv", "webrip", "web-dl", "webdl", "vodrip", "hdrip",
  "480p", "576p", "720p", "1024p", "1080p", "2160p", "4k", "uhd",
  "480", "576", "720", "1024", "1080", "2160",
  "hdr", "hdr10", "10bit", "dv", "remastered", "extended", "unrated",
  "proper", "repack", "internal", "limited",
];

// Tags that must have a separator character before them
const CLEAN_TAGS_SEP_PREFIX = ["scr", "ts", "fs", "ws", "r5"];

// Multi-word tags (spaces become separator wildcards)
const CLEAN_TAGS_MULTIWORD = ["special edition", "directors cut", "dir cut", "director's cut"];

// Multipart indicators
const CLEAN_MULTIPART = ["part", "pt", "cd", "dvd", "disk", "disc"];

// Release formats
const RELEASE_FORMATS = [
  "cam", "telesync", "workprint", "telecine", "pay-per-view rip",
  "screener", "r5", "dvd-rip", "dvd-r", "hdtv", "vodrip",
  "brrip", "bdrip", "bluray", "dvd", "webdl", "webrip",
];

function parseMovieName(name: string): { title: string; year: number | null } {
  // Strip file extension if present
  let filename = name.replace(/\.(mkv|mp4|avi|m4v|wmv|flv|mov|mpg|mpeg|ts|m2ts|divx|ogm|webm)$/i, "");

  // Replace dots and underscores with spaces (like MC does first)
  filename = filename.replace(/\./g, " ").replace(/_/g, " ");

  let cutPosition = filename.length;

  // 1: Check multipart tags (e.g. "cd1", "part 1", "disc1")
  const multipartPattern = new RegExp(
    `((?:${CLEAN_MULTIPART.join("|")})(?:${SEP_REGEX_CLASS}?)[0-9a-z])`, "i"
  );
  let m = filename.match(multipartPattern);
  if (m && m.index !== undefined && m.index < cutPosition) {
    cutPosition = m.index;
  }

  // 2: Check dvd5 / dvd9 tags
  m = filename.match(/dvd[\-_. ]?[59]/i);
  if (m && m.index !== undefined && m.index < cutPosition) {
    cutPosition = m.index;
  }

  // 3: Check tags that must have a separator prefix
  const sepPrefixPattern = new RegExp(
    `(${SEP_REGEX_CLASS}(?:${CLEAN_TAGS_SEP_PREFIX.join("|")}))(?:${SEP_REGEX_CLASS}|$)`, "i"
  );
  m = filename.match(sepPrefixPattern);
  if (m && m.index !== undefined && m.index < cutPosition) {
    cutPosition = m.index;
  }

  // 4: Check standard tags (no separator required)
  const tagsPattern = new RegExp(
    `(?:${SEP_REGEX_CLASS}|\\[|\\()?(?:${CLEAN_TAGS.join("|")})(?:${SEP_REGEX_CLASS}|\\]|\\)|$)`, "i"
  );
  m = filename.match(tagsPattern);
  if (m && m.index !== undefined && m.index < cutPosition) {
    cutPosition = m.index;
  }

  // 5: Check multi-word tags (with separator wildcards)
  for (const mw of CLEAN_TAGS_MULTIWORD) {
    const mwPattern = new RegExp(mw.replace(/ /g, `${SEP_REGEX_CLASS}`), "i");
    m = filename.match(mwPattern);
    if (m && m.index !== undefined && m.index < cutPosition) {
      cutPosition = m.index;
    }
  }

  // 6: Check release formats
  const relPattern = new RegExp(
    `(?:${SEP_REGEX_CLASS}|\\[|\\()(?:${RELEASE_FORMATS.join("|")})(?:${SEP_REGEX_CLASS}|\\]|\\)|$)`, "i"
  );
  m = filename.match(relPattern);
  if (m && m.index !== undefined && m.index < cutPosition) {
    cutPosition = m.index;
  }

  // 7: Extract year using Media Companion's priority approach:
  //    a) Year in parentheses: (2024)
  //    b) Year in brackets: [2024]
  //    c) Year with separator before AND after (won't match at position 0)
  //    This prevents titles like "1978" or "2001" from being eaten as the year.
  let year: number | null = null;
  let yearCut: number | null = null;

  // a) Check for year in parentheses first — most reliable
  let ym = filename.match(/\(((?:19|20)\d{2})\)/);
  if (ym && ym.index !== undefined) {
    year = parseInt(ym[1], 10);
    yearCut = ym.index;
  }

  // b) Check for year in square brackets
  if (year === null) {
    ym = filename.match(/\[((?:19|20)\d{2})\]/);
    if (ym && ym.index !== undefined) {
      year = parseInt(ym[1], 10);
      yearCut = ym.index;
    }
  }

  // c) Check for year with a separator before AND after (not at position 0)
  if (year === null) {
    ym = filename.match(/[\-_. \[(]((?:19|20)\d{2})[\-_. \])]/);
    if (ym && ym.index !== undefined) {
      year = parseInt(ym[1], 10);
      yearCut = ym.index;
    }
  }

  if (yearCut !== null && yearCut < cutPosition) {
    cutPosition = yearCut;
  }

  // Truncate at the earliest tag position
  if (cutPosition > 0 && cutPosition < filename.length) {
    filename = filename.substring(0, cutPosition);
  }

  // Clean trailing separators and extra whitespace
  filename = filename.replace(/[\-_. ]+$/, "").replace(/\s+/g, " ").trim();

  // Replace remaining hyphens surrounded by spaces for readability
  filename = filename.replace(/ - /g, " - ");

  return { title: filename || name, year };
}

function findCompanionFile(videoPath: string, extensions: string[]): string | null {
  const dir = dirname(videoPath);
  const nameNoExt = parse(videoPath).name;

  for (const ext of extensions) {
    // Check movie-name.nfo
    const byName = join(dir, nameNoExt + ext);
    if (existsSync(byName)) return byName;

    // Check movie.nfo (folder-based)
    const generic = join(dir, "movie" + ext);
    if (existsSync(generic)) return generic;
  }
  return null;
}

function findImageFile(videoPath: string, folderPath: string, type: "poster" | "fanart"): string | null {
  const nameNoExt = parse(videoPath).name;
  const imageExts = [".jpg", ".jpeg", ".png", ".webp"];

  for (const ext of imageExts) {
    // filename-poster.jpg
    const byName = join(folderPath, `${nameNoExt}-${type}${ext}`);
    if (existsSync(byName)) return byName;

    // poster.jpg (folder-based)
    const generic = join(folderPath, `${type}${ext}`);
    if (existsSync(generic)) return generic;
  }
  return null;
}
