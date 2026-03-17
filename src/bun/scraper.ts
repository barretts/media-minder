import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { TmdbSearchResult, MovieData, ActorData } from "./types";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

let browser: any = null;

function findChromiumPath(): string | undefined {
  const home = homedir();
  const platform = process.platform;

  // Check ms-playwright cache (installed via npx playwright install chromium)
  const msPlaywrightBase = platform === "win32"
    ? join(home, "AppData", "Local", "ms-playwright")
    : join(home, ".cache", "ms-playwright");

  if (existsSync(msPlaywrightBase)) {
    try {
      const { readdirSync } = require("fs");
      const dirs = readdirSync(msPlaywrightBase).filter((d: string) => d.startsWith("chromium"));
      dirs.sort().reverse(); // newest first
      for (const dir of dirs) {
        const winPath = join(msPlaywrightBase, dir, "chrome-win64", "chrome.exe");
        const winPath2 = join(msPlaywrightBase, dir, "chrome-win", "chrome.exe");
        const macPath = join(msPlaywrightBase, dir, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium");
        const linuxPath = join(msPlaywrightBase, dir, "chrome-linux", "chrome");
        for (const p of [winPath, winPath2, macPath, linuxPath]) {
          if (existsSync(p)) return p;
        }
      }
    } catch {}
  }

  // Common system Chrome/Chromium locations
  const candidates = platform === "win32" ? [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    join(home, "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ] : platform === "darwin" ? [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ] : [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

async function ensureBrowser() {
  if (browser) return browser;
  try {
    const pw = await import("playwright-core");
    const executablePath = findChromiumPath();
    console.log("Launching browser at:", executablePath || "(auto-detect)");
    browser = await pw.chromium.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Browser launched successfully");
    return browser;
  } catch (e) {
    console.error("Failed to launch browser:", e);
    throw e;
  }
}

async function newPage() {
  const b = await ensureBrowser();
  const page = await b.newPage();
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  return page;
}

// ---- TMDB Scraping (no API key) ----

export async function scrapeTmdbSearch(query: string, year?: number): Promise<TmdbSearchResult[]> {
  const page = await newPage();
  try {
    const searchQuery = year ? `${query} ${year}` : query;
    const url = `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(searchQuery)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    const results: TmdbSearchResult[] = await page.evaluate(() => {
      const items: any[] = [];
      const cards = document.querySelectorAll(".card.v4");

      cards.forEach((card: any) => {
        const link = card.querySelector("a.result");
        const href = link?.getAttribute("href") || "";
        const idMatch = href.match(/\/movie\/(\d+)/);
        if (!idMatch) return;

        const titleEl = card.querySelector("h2") || link;
        const title = titleEl?.textContent?.trim() || "";

        const dateEl = card.querySelector(".release_date") || card.querySelector("span.release_date");
        const dateText = dateEl?.textContent?.trim() || "";
        const yearMatch = dateText.match(/(\d{4})/);

        const overviewEl = card.querySelector(".overview p") || card.querySelector("p");
        const overview = overviewEl?.textContent?.trim() || "";

        const img = card.querySelector("img");
        const posterSrc = img?.getAttribute("src") || "";
        const posterPathMatch = posterSrc.match(/\/t\/p\/\w+(\/.+)/);

        const ratingEl = card.querySelector(".user_score_chart") || card.querySelector("[data-percent]");
        const rating = ratingEl ? parseFloat(ratingEl.getAttribute("data-percent") || "0") / 10 : 0;

        items.push({
          id: parseInt(idMatch[1], 10),
          title,
          originalTitle: title,
          year: yearMatch ? parseInt(yearMatch[1], 10) : 0,
          overview,
          posterPath: posterPathMatch ? posterPathMatch[1] : null,
          backdropPath: null,
          voteAverage: rating,
          voteCount: 0,
          releaseDate: dateText,
        });
      });

      return items;
    });

    return results;
  } catch (e) {
    console.error(`Failed to scrape TMDB search for "${query}":`, e);
    return [];
  } finally {
    await page.close();
  }
}

export async function scrapeTmdbMovieDetails(tmdbId: number): Promise<MovieData | null> {
  const page = await newPage();
  try {
    const url = `https://www.themoviedb.org/movie/${tmdbId}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const basicData = await page.evaluate(() => {
      const getText = (sel: string) => document.querySelector(sel)?.textContent?.trim() || "";
      const getAttr = (sel: string, attr: string) => document.querySelector(sel)?.getAttribute(attr) || "";

      // JSON-LD structured data
      const jsonLdEl = document.querySelector('script[type="application/ld+json"]');
      let jsonLd: any = {};
      if (jsonLdEl) {
        try { jsonLd = JSON.parse(jsonLdEl.textContent || "{}"); } catch {}
      }

      const title = getText("h2 a") || getText(".title h2") || jsonLd.name || "";
      const tagline = getText(".tagline") || "";

      // Year from release date
      const factEls = document.querySelectorAll(".facts span.release, .release_date");
      let releaseDate = "";
      factEls.forEach((el: any) => {
        const t = el.textContent?.trim() || "";
        if (/\d{2}\/\d{2}\/\d{4}/.test(t) || /\d{4}/.test(t)) releaseDate = t;
      });
      const yearMatch = releaseDate.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;

      // Runtime
      const runtimeEl = document.querySelector(".runtime") || document.querySelector('[class*="runtime"]');
      let runtime = 0;
      if (runtimeEl) {
        const rtText = runtimeEl.textContent || "";
        const hrMatch = rtText.match(/(\d+)h/);
        const minMatch = rtText.match(/(\d+)m/);
        runtime = (hrMatch ? parseInt(hrMatch[1]) * 60 : 0) + (minMatch ? parseInt(minMatch[1]) : 0);
      }

      // Rating
      const ratingEl = document.querySelector('[class*="user_score_chart"]') || document.querySelector('[data-percent]');
      const rating = ratingEl ? parseFloat(ratingEl.getAttribute("data-percent") || "0") / 10 : (jsonLd.aggregateRating?.ratingValue || 0);
      const votes = jsonLd.aggregateRating?.ratingCount || 0;

      // Plot
      const plot = getText(".overview p") || getText('[class*="overview"]') || jsonLd.description || "";

      // Genres
      const genres: string[] = [];
      document.querySelectorAll(".genres a, [class*='genre'] a").forEach((el: any) => {
        const g = el.textContent?.trim();
        if (g) genres.push(g);
      });

      // Poster
      const posterImg = document.querySelector(".poster img, .image_content img");
      const posterSrc = posterImg?.getAttribute("src") || "";
      const posterPathMatch = posterSrc.match(/\/t\/p\/\w+(\/.+)/);
      const posterPath = posterPathMatch ? posterPathMatch[1] : "";

      // Backdrop/Fanart
      const backdropEl = document.querySelector('[class*="backdrop"]');
      const backdropStyle = backdropEl?.getAttribute("style") || "";
      const backdropMatch = backdropStyle.match(/url\(['"]?([^'"]+)['"]?\)/);
      let backdropPath = "";
      if (backdropMatch) {
        const bpMatch = backdropMatch[1].match(/\/t\/p\/\w+(\/.+)/);
        backdropPath = bpMatch ? bpMatch[1] : "";
      }

      // Certification
      const certEl = document.querySelector(".certification, [class*='certification']");
      const mpaa = certEl?.textContent?.trim() || "";

      // Collection/Set
      const collectionEl = document.querySelector('[class*="collection"] a, .belongs_to a');
      const set = collectionEl?.textContent?.trim()?.replace("Part of the ", "").replace(" Collection", " Collection") || "";

      return {
        title,
        originalTitle: title,
        sortTitle: title,
        tagline,
        year,
        runtime,
        rating,
        votes,
        plot,
        outline: plot.substring(0, 300),
        genres,
        mpaa,
        posterPath,
        backdropPath,
        set,
      };
    });

    // Scrape credits page
    const credits = await scrapeTmdbCredits(page, tmdbId);

    // Scrape external IDs
    const externalIds = await scrapeTmdbExternalIds(page, tmdbId);

    const posterUrl = basicData.posterPath ? `${TMDB_IMAGE_BASE}/original${basicData.posterPath}` : "";
    const fanartUrl = basicData.backdropPath ? `${TMDB_IMAGE_BASE}/original${basicData.backdropPath}` : "";
    const thumbUrl = basicData.posterPath ? `${TMDB_IMAGE_BASE}/w500${basicData.posterPath}` : "";

    return {
      title: basicData.title,
      originalTitle: basicData.originalTitle,
      sortTitle: basicData.sortTitle,
      set: basicData.set,
      rating: basicData.rating,
      year: basicData.year,
      votes: basicData.votes,
      outline: basicData.outline,
      plot: basicData.plot,
      tagline: basicData.tagline,
      runtime: basicData.runtime,
      mpaa: basicData.mpaa,
      imdbId: externalIds.imdbId,
      tmdbId,
      trailer: "",
      genres: basicData.genres,
      directors: credits.directors,
      writers: credits.writers,
      studios: [],
      countries: [],
      actors: credits.actors,
      posterUrl,
      fanartUrl,
      thumbUrl,
    };
  } catch (e) {
    console.error(`Failed to scrape TMDB movie ${tmdbId}:`, e);
    return null;
  } finally {
    await page.close();
  }
}

async function scrapeTmdbCredits(page: any, tmdbId: number): Promise<{
  directors: string[];
  writers: string[];
  actors: ActorData[];
}> {
  try {
    await page.goto(`https://www.themoviedb.org/movie/${tmdbId}/cast`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    return await page.evaluate(() => {
      const directors: string[] = [];
      const writers: string[] = [];
      const actors: any[] = [];

      // Cast
      const castCards = document.querySelectorAll(".people.scroller .card, ol.people li");
      let order = 0;
      castCards.forEach((card: any) => {
        const nameEl = card.querySelector("a p, a") ;
        const name = nameEl?.textContent?.trim() || "";
        const charEl = card.querySelector(".character, p.character");
        const role = charEl?.textContent?.trim() || "";
        const img = card.querySelector("img");
        const thumbSrc = img?.getAttribute("src") || "";
        const thumbMatch = thumbSrc.match(/\/t\/p\/\w+(\/.+)/);

        if (name) {
          actors.push({
            name,
            role,
            thumb: thumbMatch ? `https://image.tmdb.org/t/p/w185${thumbMatch[1]}` : "",
            order: order++,
          });
        }
      });

      // Crew
      const crewSections = document.querySelectorAll(".crew_list, section.panel");
      crewSections.forEach((section: any) => {
        const headerEl = section.querySelector("h3, h4, p.department");
        const header = headerEl?.textContent?.trim()?.toLowerCase() || "";
        const people = section.querySelectorAll("a, li");
        people.forEach((p: any) => {
          const pName = p.textContent?.trim();
          if (!pName || pName.length > 100) return;
          const jobEl = p.querySelector(".job, span");
          const job = jobEl?.textContent?.trim()?.toLowerCase() || header;
          if (job.includes("director") || header.includes("directing")) {
            if (!directors.includes(pName)) directors.push(pName);
          }
          if (job.includes("writ") || job.includes("screenplay") || header.includes("writing")) {
            if (!writers.includes(pName)) writers.push(pName);
          }
        });
      });

      return { directors, writers, actors: actors.slice(0, 30) };
    });
  } catch (e) {
    console.error(`Failed to scrape TMDB credits for ${tmdbId}:`, e);
    return { directors: [], writers: [], actors: [] };
  }
}

async function scrapeTmdbExternalIds(page: any, tmdbId: number): Promise<{ imdbId: string }> {
  try {
    // The IMDB link is often on the main movie page sidebar
    await page.goto(`https://www.themoviedb.org/movie/${tmdbId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(1500);

    const imdbId = await page.evaluate(() => {
      const imdbLink = document.querySelector('a[href*="imdb.com/title/"]');
      if (imdbLink) {
        const href = imdbLink.getAttribute("href") || "";
        const match = href.match(/(tt\d+)/);
        return match ? match[1] : "";
      }
      return "";
    });

    return { imdbId };
  } catch {
    return { imdbId: "" };
  }
}

// ---- IMDB Scraping ----

export async function scrapeImdbPage(imdbId: string): Promise<{
  rating: number;
  votes: number;
  posterUrl: string;
  plot: string;
  genres: string[];
  directors: string[];
  cast: { name: string; role: string; thumb: string }[];
} | null> {
  const page = await newPage();
  try {
    const url = `https://www.imdb.com/title/${imdbId}/`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    const data = await page.evaluate(() => {
      // Try JSON-LD structured data first
      const jsonLdEl = document.querySelector('script[type="application/ld+json"]');
      if (jsonLdEl) {
        try {
          const parsed = JSON.parse(jsonLdEl.textContent || "{}");
          return {
            rating: parsed.aggregateRating?.ratingValue || 0,
            votes: parsed.aggregateRating?.ratingCount || 0,
            posterUrl: parsed.image || "",
            plot: parsed.description || "",
            genres: Array.isArray(parsed.genre) ? parsed.genre : parsed.genre ? [parsed.genre] : [],
            directors: (parsed.director || []).map((d: any) => typeof d === "string" ? d : d.name || ""),
            cast: (parsed.actor || []).map((a: any) => ({
              name: typeof a === "string" ? a : a.name || "",
              role: "",
              thumb: "",
            })),
          };
        } catch {}
      }

      return {
        rating: 0,
        votes: 0,
        posterUrl: "",
        plot: document.querySelector('[data-testid="plot-xs_to_m"]')?.textContent?.trim() || "",
        genres: [],
        directors: [],
        cast: [],
      };
    });

    return data;
  } catch (e) {
    console.error(`Failed to scrape IMDB page for ${imdbId}:`, e);
    return null;
  } finally {
    await page.close();
  }
}

export async function scrapeImdbSearchResults(query: string, year?: number): Promise<
  { imdbId: string; title: string; year: number; posterUrl: string }[]
> {
  const page = await newPage();
  try {
    const searchQuery = year ? `${query} ${year}` : query;
    const url = `https://www.imdb.com/find/?q=${encodeURIComponent(searchQuery)}&s=tt&ttype=ft`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    const results = await page.evaluate(() => {
      const items: { imdbId: string; title: string; year: number; posterUrl: string }[] = [];
      const resultElements = document.querySelectorAll('[class*="find-result-item"], [class*="ipc-metadata-list-summary-item"]');

      resultElements.forEach((el: any) => {
        const link = el.querySelector("a[href*='/title/']");
        if (!link) return;
        const href = link.getAttribute("href") || "";
        const match = href.match(/\/title\/(tt\d+)/);
        if (!match) return;

        const titleEl = el.querySelector('[class*="ipc-metadata-list-summary-item__t"]') || link;
        const title = titleEl?.textContent?.trim() || "";
        const yearEl = el.querySelector('[class*="ipc-metadata-list-summary-item__li"]');
        const yearText = yearEl?.textContent?.trim() || "";
        const yearMatch = yearText.match(/\b(19|20)\d{2}\b/);
        const img = el.querySelector("img");

        items.push({
          imdbId: match[1],
          title,
          year: yearMatch ? parseInt(yearMatch[0], 10) : 0,
          posterUrl: img?.src || "",
        });
      });
      return items;
    });

    return results;
  } catch (e) {
    console.error(`Failed to scrape IMDB search for "${query}":`, e);
    return [];
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
