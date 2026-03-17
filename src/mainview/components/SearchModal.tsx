import { useState, useEffect } from "react";
import { X, Search, Loader2, Star, Calendar, Film } from "lucide-react";
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

  const mb: React.CSSProperties = {
    background: '#bebebe',
    borderTop: '2px solid #ffffff',
    borderLeft: '2px solid #ffffff',
    borderBottom: '2px solid #404040',
    borderRight: '2px solid #404040',
    color: '#000000',
    cursor: 'pointer',
    fontSize: '11px',
    padding: '2px 10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  };
  const inset: React.CSSProperties = {
    background: '#ffffff',
    borderTop: '2px solid #404040',
    borderLeft: '2px solid #404040',
    borderBottom: '2px solid #ffffff',
    borderRight: '2px solid #ffffff',
    color: '#000000',
    fontSize: '11px',
    padding: '2px 6px',
    outline: 'none',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background: 'rgba(50,40,80,0.6)'}}>
      {/* Motif window */}
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{
          background: '#bebebe',
          borderTop: '2px solid #ffffff',
          borderLeft: '2px solid #ffffff',
          borderBottom: '2px solid #404040',
          borderRight: '2px solid #404040',
          boxShadow: '4px 4px 8px rgba(0,0,0,0.5)',
        }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-2 py-1"
          style={{background: 'linear-gradient(to right, #847bbd, #524a8c)', userSelect: 'none'}}>
          <div className="flex items-center gap-2">
            <Film size={11} style={{color: '#ffffff'}} />
            <span style={{color: '#ffffff', fontSize: '11px', fontWeight: 'bold'}}>Search Movie</span>
          </div>
          <div className="flex items-center gap-1">
            <span style={{color: '#ccccee', fontSize: '10px', marginRight: '6px'}}>{movie.fileName}</span>
            <button onClick={onClose}
              style={{...mb, padding: '1px 6px', fontSize: '10px', background: '#adb5c6'}}>
              <X size={10} />
            </button>
          </div>
        </div>

        {/* Source Toggle + Search Bar */}
        <div className="p-2 space-y-1.5" style={{borderBottom: '1px solid #808080'}}>
          <div className="flex gap-1">
            <button onClick={() => switchSource("tmdb")} className="flex-1 py-0.5"
              style={source === "tmdb" ? {...mb, background: '#000080', color: '#ffffff', borderColor: '#404040'} : mb}>
              TMDB
            </button>
            <button onClick={() => switchSource("imdb")} className="flex-1 py-0.5"
              style={source === "imdb" ? {...mb, background: '#000080', color: '#ffffff', borderColor: '#404040'} : mb}>
              IMDB
            </button>
          </div>
          <div className="flex gap-1">
            <input type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Movie title..."
              className="flex-1 focus:outline-none"
              style={inset}
            />
            <input type="text" value={year}
              onChange={(e) => setYear(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Year"
              className="w-14 focus:outline-none"
              style={inset}
            />
            <button onClick={handleSearch} disabled={searching || !query.trim()}
              className="flex items-center gap-1 disabled:opacity-50"
              style={mb}>
              {searching ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
              Search
            </button>
          </div>
          {error && <p style={{fontSize: '11px', color: '#cc0000'}}>{error}</p>}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto" style={{background: '#bebebe'}}>
          {searching ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin" style={{color: '#524a8c'}} />
              <span className="ml-2" style={{fontSize: '11px', color: '#333333'}}>Searching {source.toUpperCase()}...</span>
            </div>
          ) : source === "tmdb" ? (
            tmdbResults.map((result) => (
              <button
                key={result.id}
                onClick={() => onSelect(result.id)}
                disabled={loading}
                className="flex w-full items-start gap-2 p-1.5 text-left disabled:opacity-50"
                style={{borderBottom: '1px solid #d0d0d0', background: 'transparent'}}
                onMouseEnter={e => (e.currentTarget.style.background = '#adb5c6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {result.posterPath ? (
                  <img src={`https://image.tmdb.org/t/p/w92${result.posterPath}`} alt={result.title}
                    className="w-10 h-14 object-cover shrink-0"
                    style={{borderTop: '1px solid #ffffff', borderLeft: '1px solid #ffffff', borderBottom: '1px solid #808080', borderRight: '1px solid #808080'}}
                  />
                ) : (
                  <div className="w-10 h-14 shrink-0 flex items-center justify-center"
                    style={{background: '#d0d0d0', border: '1px solid #808080', fontSize: '9px', color: '#666666'}}>No img</div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate" style={{fontSize: '11px', color: '#000000'}}>{result.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {result.year > 0 && (
                      <span className="flex items-center gap-0.5" style={{fontSize: '10px', color: '#444444'}}>
                        <Calendar size={9} /> {result.year}
                      </span>
                    )}
                    {result.voteAverage > 0 && (
                      <span className="flex items-center gap-0.5" style={{fontSize: '10px', color: '#664400'}}>
                        <Star size={9} fill="currentColor" /> {result.voteAverage.toFixed(1)}
                      </span>
                    )}
                    <span style={{fontSize: '10px', color: '#333388'}}>TMDB: {result.id}</span>
                  </div>
                  {result.overview && (
                    <p className="line-clamp-2" style={{fontSize: '10px', color: '#333333', marginTop: '2px'}}>{result.overview}</p>
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
                className="flex w-full items-start gap-2 p-1.5 text-left disabled:opacity-50"
                style={{borderBottom: '1px solid #d0d0d0', background: 'transparent'}}
                onMouseEnter={e => (e.currentTarget.style.background = '#adb5c6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {result.posterUrl ? (
                  <img src={result.posterUrl} alt={result.title}
                    className="w-10 h-14 object-cover shrink-0"
                    style={{borderTop: '1px solid #ffffff', borderLeft: '1px solid #ffffff', borderBottom: '1px solid #808080', borderRight: '1px solid #808080'}}
                  />
                ) : (
                  <div className="w-10 h-14 shrink-0 flex items-center justify-center"
                    style={{background: '#d0d0d0', border: '1px solid #808080', fontSize: '9px', color: '#666666'}}>No img</div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate" style={{fontSize: '11px', color: '#000000'}}>{result.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {result.year > 0 && (
                      <span className="flex items-center gap-0.5" style={{fontSize: '10px', color: '#444444'}}>
                        <Calendar size={9} /> {result.year}
                      </span>
                    )}
                    <span style={{fontSize: '10px', color: '#664400'}}>{result.imdbId}</span>
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
