import { useState, useEffect } from "react";
import { X, Search, Loader2, Star, Calendar } from "lucide-react";
import { api } from "../api";
import type { ScannedMovie, TmdbSearchResult } from "../types";

type SearchSource = "tmdb" | "imdb";

interface ImdbResult {
  imdbId: string;
  title: string;
  year: number;
  posterUrl: string;
}

interface SearchModalProps {
  movie: ScannedMovie;
  onClose: () => void;
  onSelect: (tmdbId: number) => void;
  onSelectImdb: (imdbId: string) => void;
  loading: boolean;
  cleanupStrings?: string[];
}

function applyCleanup(title: string, cleanupStrings: string[] = []): string {
  let result = title;
  for (const s of cleanupStrings) result = result.replace(s, "");
  return result.trim().replace(/[-_.,\s]+$/, "").trim();
}

export function SearchModal({ movie, onClose, onSelect, onSelectImdb, loading, cleanupStrings }: SearchModalProps) {
  const [query, setQuery] = useState(() => applyCleanup(movie.parsedTitle, cleanupStrings));
  const [year, setYear] = useState(movie.parsedYear?.toString() || "");
  const [source, setSource] = useState<SearchSource>("tmdb");
  const [tmdbResults, setTmdbResults] = useState<TmdbSearchResult[]>([]);
  const [imdbResults, setImdbResults] = useState<ImdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setSearching(true);
    setError("");
    try {
      if (source === "tmdb") {
        const data = await api.search(query, year ? parseInt(year, 10) : undefined);
        setTmdbResults(data.results || []);
        setImdbResults([]);
        if ((data.results || []).length === 0) setError("No TMDB results. Try IMDB instead.");
      } else {
        const data = await api.imdbSearch(query, year ? parseInt(year, 10) : undefined);
        setImdbResults(data.results || []);
        setTmdbResults([]);
        if ((data.results || []).length === 0) setError("No IMDB results. Try different search terms.");
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSearching(false);
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const switchSource = (s: SearchSource) => {
    setSource(s);
    setTmdbResults([]);
    setImdbResults([]);
    setError("");
    // Auto-search with the new source immediately
    setTimeout(() => {
      if (query.trim()) {
        setSearching(true);
        const yearNum = year ? parseInt(year, 10) : undefined;
        const searchFn = s === "tmdb"
          ? api.search(query, yearNum)
          : api.imdbSearch(query, yearNum);
        searchFn.then((data) => {
          if (s === "tmdb") {
            setTmdbResults(data.results || []);
            if ((data.results || []).length === 0) setError("No TMDB results. Try IMDB instead.");
          } else {
            setImdbResults(data.results || []);
            if ((data.results || []).length === 0) setError("No IMDB results. Try different search terms.");
          }
        }).catch((e: any) => setError(e.message))
          .finally(() => setSearching(false));
      }
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] bg-surface-900 rounded-xl shadow-2xl border border-surface-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-700">
          <div>
            <h2 className="text-lg font-semibold text-surface-100">Search Movie</h2>
            <p className="text-xs text-surface-400 mt-0.5">
              File: {movie.fileName}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Source Toggle + Search Bar */}
        <div className="p-4 border-b border-surface-800">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => switchSource("tmdb")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                source === "tmdb"
                  ? "bg-blue-600 text-white"
                  : "bg-surface-800 text-surface-400 hover:text-surface-200"
              }`}
            >
              TMDB
            </button>
            <button
              onClick={() => switchSource("imdb")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                source === "imdb"
                  ? "bg-amber-600 text-white"
                  : "bg-surface-800 text-surface-400 hover:text-surface-200"
              }`}
            >
              IMDB
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Movie title..."
              className="flex-1 rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Year"
              className="w-20 rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors ${
                source === "imdb" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <span className="ml-2 text-sm text-surface-400">Searching {source.toUpperCase()}...</span>
            </div>
          ) : source === "tmdb" ? (
            tmdbResults.map((result) => (
              <button
                key={result.id}
                onClick={() => onSelect(result.id)}
                disabled={loading}
                className="flex w-full items-start gap-3 rounded-lg p-3 text-left hover:bg-surface-800 transition-colors disabled:opacity-50"
              >
                {result.posterPath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                    alt={result.title}
                    className="w-14 h-20 rounded object-cover shrink-0 bg-surface-800"
                  />
                ) : (
                  <div className="w-14 h-20 rounded bg-surface-800 shrink-0 flex items-center justify-center text-surface-600 text-xs">
                    No img
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100">{result.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {result.year > 0 && (
                      <span className="flex items-center gap-1 text-xs text-surface-400">
                        <Calendar size={10} /> {result.year}
                      </span>
                    )}
                    {result.voteAverage > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <Star size={10} fill="currentColor" /> {result.voteAverage.toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs text-blue-400">TMDB: {result.id}</span>
                  </div>
                  {result.overview && (
                    <p className="text-xs text-surface-500 mt-1 line-clamp-2">{result.overview}</p>
                  )}
                </div>
              </button>
            ))
          ) : (
            imdbResults.map((result) => (
              <button
                key={result.imdbId}
                onClick={() => onSelectImdb(result.imdbId)}
                disabled={loading}
                className="flex w-full items-start gap-3 rounded-lg p-3 text-left hover:bg-surface-800 transition-colors disabled:opacity-50"
              >
                {result.posterUrl ? (
                  <img
                    src={result.posterUrl}
                    alt={result.title}
                    className="w-14 h-20 rounded object-cover shrink-0 bg-surface-800"
                  />
                ) : (
                  <div className="w-14 h-20 rounded bg-surface-800 shrink-0 flex items-center justify-center text-surface-600 text-xs">
                    No img
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100">{result.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {result.year > 0 && (
                      <span className="flex items-center gap-1 text-xs text-surface-400">
                        <Calendar size={10} /> {result.year}
                      </span>
                    )}
                    <span className="text-xs text-amber-400">{result.imdbId}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
