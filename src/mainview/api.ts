const API_BASE = "http://localhost:3457";

async function request(path: string, method: string = "GET", body?: any): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  getSettings: () => request("/api/settings"),
  saveSettings: (settings: any) => request("/api/settings", "POST", settings),
  scan: () => request("/api/scan", "POST"),
  getMovies: () => request("/api/movies"),
  search: (query: string, year?: number) => request("/api/search", "POST", { query, year }),
  getMovieDetails: (tmdbId: number) => request("/api/movie-details", "POST", { tmdbId }),
  matchMovie: (movieId: string, tmdbId: number) => request("/api/match", "POST", { movieId, tmdbId }),
  saveNfo: (movieId: string) => request("/api/save-nfo", "POST", { movieId }),
  downloadImages: (movieId: string) => request("/api/download-images", "POST", { movieId }),
  processMovie: (movieId: string, tmdbId: number) => request("/api/process", "POST", { movieId, tmdbId }),
  autoMatch: () => request("/api/auto-match", "POST"),
  ignoreMovie: (movieId: string, ignored: boolean = true) => request("/api/ignore", "POST", { movieId, ignored }),
  imdbSearch: (query: string, year?: number) => request("/api/imdb-search", "POST", { query, year }),
  imdbProcess: (movieId: string, imdbId: string) => request("/api/imdb-process", "POST", { movieId, imdbId }),
  getMovieImages: (movieId: string) => request("/api/movie-images", "POST", { movieId }),
  saveImage: (movieId: string, imageUrl: string, imageType: "poster" | "fanart") => request("/api/save-image", "POST", { movieId, imageUrl, imageType }),
  unsetMovie: (movieId: string) => request("/api/unset-movie", "POST", { movieId }),
};
