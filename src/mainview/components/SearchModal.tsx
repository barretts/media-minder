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

  const solBtn = {
    primary: {background: 'linear-gradient(to bottom, #1a7a9a, #0d4d66)', color: '#cce8f0', border: '1px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0'} as React.CSSProperties,
    secondary: {background: 'linear-gradient(to bottom, #144960, #0d3347)', color: '#7ab8cc', border: '1px solid #0a3d52', borderTopColor: '#1d7fa0', borderLeftColor: '#1d7fa0'} as React.CSSProperties,
    active: {background: 'linear-gradient(to bottom, #0d3347, #1a6580)', color: '#48cae4', border: '1px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0'} as React.CSSProperties,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background: 'rgba(4,15,24,0.85)'}}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{background: '#071e2e', border: '2px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0', boxShadow: '4px 4px 0 #040f18'}}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2"
          style={{borderBottom: '2px solid #0a3d52', boxShadow: 'inset 0 -1px 0 #3aa0c0', background: 'linear-gradient(to bottom, #1a6580, #0d3347)'}}>
          <div>
            <h2 className="text-sm font-bold" style={{color: '#48cae4'}}>Search Movie</h2>
            <p className="text-xs mt-0.5" style={{color: '#4e9ab4'}}>File: {movie.fileName}</p>
          </div>
          <button onClick={onClose} className="p-1" style={{color: '#4e9ab4'}}>
            <X size={16} />
          </button>
        </div>

        {/* Source Toggle + Search Bar */}
        <div className="p-3 space-y-2" style={{borderBottom: '1px solid #0a3d52'}}>
          <div className="flex gap-1.5">
            <button onClick={() => switchSource("tmdb")} className="flex-1 py-1 text-xs font-medium"
              style={source === "tmdb" ? solBtn.active : solBtn.secondary}>TMDB</button>
            <button onClick={() => switchSource("imdb")} className="flex-1 py-1 text-xs font-medium"
              style={source === "imdb" ? solBtn.active : solBtn.secondary}>IMDB</button>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Movie title..."
              className="flex-1 px-2 py-1 text-xs focus:outline-none"
              style={{background: '#040f18', border: '1px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0', color: '#cce8f0'}}
            />
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Year"
              className="w-16 px-2 py-1 text-xs focus:outline-none"
              style={{background: '#040f18', border: '1px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0', color: '#cce8f0'}}
            />
            <button onClick={handleSearch} disabled={searching || !query.trim()}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium disabled:opacity-40"
              style={solBtn.primary}>
              {searching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              Search
            </button>
          </div>
          {error && <p className="text-xs" style={{color: '#e07c30'}}>{error}</p>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{color: '#48cae4'}} />
              <span className="ml-2 text-xs" style={{color: '#4e9ab4'}}>Searching {source.toUpperCase()}...</span>
            </div>
          ) : source === "tmdb" ? (
            tmdbResults.map((result) => (
              <button
                key={result.id}
                onClick={() => onSelect(result.id)}
                disabled={loading}
                className="flex w-full items-start gap-3 p-2 text-left disabled:opacity-40 transition-colors"
                style={{borderBottom: '1px solid #071e2e'}}
                onMouseEnter={e => (e.currentTarget.style.background = '#0d3347')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {result.posterPath ? (
                  <img src={`https://image.tmdb.org/t/p/w92${result.posterPath}`} alt={result.title}
                    className="w-12 h-18 object-cover shrink-0"
                    style={{border: '1px solid #0a3d52', borderTopColor: '#1d7fa0', borderLeftColor: '#1d7fa0'}}
                  />
                ) : (
                  <div className="w-12 h-16 shrink-0 flex items-center justify-center text-xs"
                    style={{background: '#040f18', border: '1px solid #0a3d52', color: '#2d7a96'}}>No img</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{color: '#cce8f0'}}>{result.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {result.year > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{color: '#4e9ab4'}}>
                        <Calendar size={10} /> {result.year}
                      </span>
                    )}
                    {result.voteAverage > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{color: '#c8a020'}}>
                        <Star size={10} fill="currentColor" /> {result.voteAverage.toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs" style={{color: '#2d7a96'}}>TMDB: {result.id}</span>
                  </div>
                  {result.overview && (
                    <p className="text-xs mt-1 line-clamp-2" style={{color: '#4e9ab4'}}>{result.overview}</p>
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
                className="flex w-full items-start gap-3 p-2 text-left disabled:opacity-40"
                style={{borderBottom: '1px solid #071e2e'}}
                onMouseEnter={e => (e.currentTarget.style.background = '#0d3347')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {result.posterUrl ? (
                  <img src={result.posterUrl} alt={result.title}
                    className="w-12 h-16 object-cover shrink-0"
                    style={{border: '1px solid #0a3d52', borderTopColor: '#1d7fa0', borderLeftColor: '#1d7fa0'}}
                  />
                ) : (
                  <div className="w-12 h-16 shrink-0 flex items-center justify-center text-xs"
                    style={{background: '#040f18', border: '1px solid #0a3d52', color: '#2d7a96'}}>No img</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{color: '#cce8f0'}}>{result.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {result.year > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{color: '#4e9ab4'}}>
                        <Calendar size={10} /> {result.year}
                      </span>
                    )}
                    <span className="text-xs" style={{color: '#c8a020'}}>{result.imdbId}</span>
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
