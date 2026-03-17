import { Search, CheckCircle, AlertCircle, FileText, EyeOff, X, LayoutList, LayoutGrid, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { ScannedMovie, SortField, SortDir } from "../types";

const API = "http://localhost:3457";

function posterSrc(movie: ScannedMovie): string | null {
  if (movie.posterPath) return `${API}/api/file?path=${encodeURIComponent(movie.posterPath)}&t=${movie.posterTs ?? 0}`;
  if (movie.movieData?.thumbUrl) return movie.movieData.thumbUrl;
  if (movie.movieData?.posterUrl) return movie.movieData.posterUrl;
  return null;
}

function fanartSrc(movie: ScannedMovie): string | null {
  if (movie.fanartPath) return `${API}/api/file?path=${encodeURIComponent(movie.fanartPath)}&t=${movie.fanartTs ?? 0}`;
  if (movie.movieData?.fanartUrl) return movie.movieData.fanartUrl;
  return null;
}

interface MovieListProps {
  movies: ScannedMovie[];
  selectedMovie: ScannedMovie | null;
  onSelect: (movie: ScannedMovie) => void;
  onSearch: (movie: ScannedMovie) => void;
  onIgnore: (movie: ScannedMovie, ignored: boolean) => void;
  filter: "all" | "unmatched" | "matched" | "ignored";
  onFilterChange: (filter: "all" | "unmatched" | "matched" | "ignored") => void;
  loading: boolean;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
  sortField: SortField;
  sortDir: SortDir;
  onSortChange: (field: SortField, dir: SortDir) => void;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + " MB";
  return bytes + " B";
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "year", label: "Year" },
  { value: "size", label: "File Size" },
  { value: "resolution", label: "Resolution" },
  { value: "status", label: "Status" },
];

export function MovieList({ movies, selectedMovie, onSelect, onSearch, onIgnore, filter, onFilterChange, loading, viewMode, onViewModeChange, sortField, sortDir, onSortChange }: MovieListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery.trim()
    ? movies.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          (m.movieData?.title || m.parsedTitle).toLowerCase().includes(q) ||
          m.fileName.toLowerCase().includes(q)
        );
      })
    : movies;

  const visibleMovies = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "title":
        cmp = (a.movieData?.title || a.parsedTitle).localeCompare(b.movieData?.title || b.parsedTitle);
        break;
      case "year":
        cmp = (a.movieData?.year || a.parsedYear || 0) - (b.movieData?.year || b.parsedYear || 0);
        break;
      case "size":
        cmp = (a.fileSize ?? 0) - (b.fileSize ?? 0);
        break;
      case "resolution":
        cmp = (a.height ?? 0) - (b.height ?? 0);
        break;
      case "status": {
        const rank = (m: ScannedMovie) => m.ignored ? 0 : m.matched ? 2 : 1;
        cmp = rank(a) - rank(b);
        break;
      }
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div
      className={`flex flex-col ${viewMode === "grid" ? "w-full" : "w-80"}`}
      style={{borderRight: '2px solid #0a3d52', boxShadow: 'inset -1px 0 0 #3aa0c0', background: '#071e2e'}}
    >
      <div className="p-2 space-y-1.5" style={{borderBottom: '2px solid #0a3d52', boxShadow: 'inset 0 -1px 0 #3aa0c0', background: 'linear-gradient(to bottom, #0d3347, #071e2e)'}}>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{color: '#4e9ab4'}} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter movies…"
              className="w-full pl-7 pr-6 py-1 text-xs focus:outline-none"
              style={{background: '#040f18', border: '1px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0', color: '#cce8f0'}}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                style={{color: '#4e9ab4'}}
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            onClick={() => onViewModeChange(viewMode === "list" ? "grid" : "list")}
            className="shrink-0 px-2 transition-colors"
            style={{background: 'linear-gradient(to bottom, #144960, #0d3347)', border: '1px solid #0a3d52', borderTopColor: '#1d7fa0', borderLeftColor: '#1d7fa0', color: '#7ab8cc'}}
            title={viewMode === "list" ? "Switch to poster grid" : "Switch to list"}
          >
            {viewMode === "list" ? <LayoutGrid size={13} /> : <LayoutList size={13} />}
          </button>
        </div>
        <div className="flex gap-1">
          {(["all", "unmatched", "matched", "ignored"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className="flex-1 py-0.5 text-xs font-medium capitalize transition-colors"
              style={filter === f ? {
                background: 'linear-gradient(to bottom, #0d3347, #1a6580)',
                color: '#48cae4',
                border: '1px solid #0a3d52',
                borderTopColor: '#3aa0c0',
                borderLeftColor: '#3aa0c0',
              } : {
                background: 'linear-gradient(to bottom, #144960, #0d3347)',
                color: '#7ab8cc',
                border: '1px solid #0a3d52',
                borderTopColor: '#1d7fa0',
                borderLeftColor: '#1d7fa0',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpDown size={11} className="shrink-0" style={{color: '#4e9ab4'}} />
          <select
            value={sortField}
            onChange={(e) => onSortChange(e.target.value as SortField, sortDir)}
            className="flex-1 py-0.5 px-1 text-xs focus:outline-none"
            style={{background: '#040f18', border: '1px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0', color: '#cce8f0'}}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => onSortChange(sortField, sortDir === "asc" ? "desc" : "asc")}
            className="px-1.5 py-0.5 text-xs transition-colors"
            style={{background: 'linear-gradient(to bottom, #144960, #0d3347)', border: '1px solid #0a3d52', borderTopColor: '#1d7fa0', borderLeftColor: '#1d7fa0', color: '#7ab8cc'}}
          >
            {sortDir === "asc" ? "A→Z" : "Z→A"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center" style={{color: '#4e9ab4'}}>
            <FileText size={32} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No movies found</p>
            <p className="text-xs mt-1" style={{color: '#2d7a96'}}>Add directories in Settings, then click Scan Folders</p>
          </div>
        ) : viewMode === "list" ? (
          visibleMovies.map((movie) => {
            const thumb = posterSrc(movie);
            const isSelected = selectedMovie?.id === movie.id;
            return (
              <div
                key={movie.id}
                onClick={() => onSelect(movie)}
                className="flex items-center gap-2 p-1.5 cursor-pointer transition-colors"
                style={isSelected ? {
                  background: 'linear-gradient(to right, #0d3347, #144960)',
                  borderLeft: '3px solid #48cae4',
                  borderBottom: '1px solid #0a3d52',
                } : {
                  background: 'transparent',
                  borderLeft: '3px solid transparent',
                  borderBottom: '1px solid #071e2e',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#0d3347'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div className="shrink-0 w-8 h-12 overflow-hidden flex items-center justify-center" style={{border: '1px solid #0a3d52', background: '#040f18'}}>
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <FileText size={13} style={{color: '#1d5f78'}} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{color: '#cce8f0'}}>
                    {movie.movieData?.title || movie.parsedTitle}
                  </p>
                  <p className="text-xs truncate" style={{color: '#4e9ab4'}}>
                    {movie.movieData?.year || movie.parsedYear || ""}
                  </p>
                  <div className="flex items-center gap-2">
                    {movie.ignored ? (
                      <span className="flex items-center gap-0.5 text-xs" style={{color: '#e07c30'}}><EyeOff size={9} /> ignored</span>
                    ) : movie.matched ? (
                      <span className="flex items-center gap-0.5 text-xs" style={{color: '#2d9e6e'}}><CheckCircle size={9} /> matched</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-xs" style={{color: '#c07020'}}><AlertCircle size={9} /> unmatched</span>
                    )}
                    {movie.parts?.length > 1 && (
                      <span className="text-xs" style={{color: '#7ab8cc'}}>{movie.parts.length} parts</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onIgnore(movie, !movie.ignored); }}
                    className="p-1 transition-colors"
                    style={{color: movie.ignored ? '#e07c30' : '#2d7a96'}}
                    title={movie.ignored ? "Unignore" : "Ignore"}
                  >
                    <EyeOff size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSearch(movie); }}
                    className="p-1 transition-colors"
                    style={{color: '#2d7a96'}}
                    title="Search TMDB"
                  >
                    <Search size={13} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          /* Poster grid view */
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 p-2">
            {visibleMovies.map((movie) => {
              const bg = fanartSrc(movie);
              const thumb = posterSrc(movie);
              const title = movie.movieData?.title || movie.parsedTitle;
              const isSelected = selectedMovie?.id === movie.id;
              return (
                <div
                  key={movie.id}
                  onClick={() => onSelect(movie)}
                  className="relative group cursor-pointer flex flex-col transition-all"
                  style={isSelected ? {
                    border: '2px solid #48cae4',
                    boxShadow: '0 0 6px #1a6580',
                  } : {
                    border: '2px solid #0a3d52',
                    borderTopColor: '#1d7fa0',
                    borderLeftColor: '#1d7fa0',
                  }}
                >
                  <div className="aspect-[2/3] relative overflow-hidden" style={{background: '#040f18'}}>
                    {thumb ? (
                      <img src={thumb} alt={title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : bg ? (
                      <img src={bg} alt={title} className="w-full h-full object-cover opacity-40" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText size={24} style={{color: '#1d5f78'}} />
                      </div>
                    )}
                    <div className={`absolute top-1 right-1 w-2 h-2 rounded-full`}
                      style={{background: movie.ignored ? '#e07c30' : movie.matched ? '#2d9e6e' : '#c07020'}} />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSearch(movie); }}
                        className="p-1.5"
                        style={{background: '#0d4d66', border: '1px solid #3aa0c0', color: '#cce8f0'}}
                        title="Search TMDB"
                      >
                        <Search size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onIgnore(movie, !movie.ignored); }}
                        className="p-1.5"
                        style={{background: movie.ignored ? '#1a0e00' : '#1a0e00', border: '1px solid #a05520', color: '#e07c30'}}
                        title={movie.ignored ? "Unignore" : "Ignore"}
                      >
                        <EyeOff size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="px-1 py-0.5" style={{background: '#0d3347'}}>
                    <p className="text-xs font-medium truncate leading-tight" style={{color: '#cce8f0'}}>{title}</p>
                    {movie.movieData?.year || movie.parsedYear ? <p className="text-xs" style={{color: '#4e9ab4'}}>{movie.movieData?.year || movie.parsedYear}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
