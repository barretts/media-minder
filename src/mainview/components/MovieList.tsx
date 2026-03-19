import { Search, CheckCircle, AlertCircle, FileText, EyeOff, X, LayoutList, LayoutGrid, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { ScannedMovie, SortField, SortDir } from "../types";

import { convertFileSrc } from "@tauri-apps/api/core";

function posterSrc(movie: ScannedMovie): string | null {
  if (movie.posterPath) return `${convertFileSrc(movie.posterPath)}?t=${movie.posterTs ?? 0}`;
  if (movie.movieData?.thumbUrl) return movie.movieData.thumbUrl;
  if (movie.movieData?.posterUrl) return movie.movieData.posterUrl;
  return null;
}

function fanartSrc(movie: ScannedMovie): string | null {
  if (movie.fanartPath) return `${convertFileSrc(movie.fanartPath)}?t=${movie.fanartTs ?? 0}`;
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

  const motifBtn: React.CSSProperties = {
    background: '#bebebe',
    borderTop: '2px solid #ffffff',
    borderLeft: '2px solid #ffffff',
    borderBottom: '2px solid #404040',
    borderRight: '2px solid #404040',
    color: '#000000',
    cursor: 'pointer',
    fontSize: '11px',
  };
  const motifInset: React.CSSProperties = {
    background: '#ffffff',
    borderTop: '2px solid #404040',
    borderLeft: '2px solid #404040',
    borderBottom: '2px solid #ffffff',
    borderRight: '2px solid #ffffff',
    color: '#000000',
    fontSize: '11px',
  };

  return (
    <div
      className={`flex flex-col ${viewMode === "grid" ? "w-full" : "w-72"}`}
      style={{background: '#bebebe', borderRight: '2px solid #808080'}}
    >
      {/* Toolbar / header */}
      <div className="p-1.5 space-y-1" style={{borderBottom: '2px solid #808080', background: '#bebebe'}}>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{color: '#555555'}} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter movies…"
              className="w-full pl-6 pr-5 py-0.5 focus:outline-none"
              style={motifInset}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-1 top-1/2 -translate-y-1/2" style={{color: '#555555'}}>
                <X size={10} />
              </button>
            )}
          </div>
          <button
            onClick={() => onViewModeChange(viewMode === "list" ? "grid" : "list")}
            className="shrink-0 px-1.5"
            style={motifBtn}
            title={viewMode === "list" ? "Switch to poster grid" : "Switch to list"}
          >
            {viewMode === "list" ? <LayoutGrid size={12} /> : <LayoutList size={12} />}
          </button>
        </div>
        <div className="flex gap-1">
          {(["all", "unmatched", "matched", "ignored"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className="flex-1 py-0.5 capitalize"
              style={filter === f ? {
                background: '#000080',
                color: '#ffffff',
                border: '1px solid #404040',
                fontSize: '11px',
              } : motifBtn}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpDown size={10} className="shrink-0" style={{color: '#555555'}} />
          <select
            value={sortField}
            onChange={(e) => onSortChange(e.target.value as SortField, sortDir)}
            className="flex-1 py-0.5 px-1 focus:outline-none"
            style={motifInset}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => onSortChange(sortField, sortDir === "asc" ? "desc" : "asc")}
            className="px-1.5 py-0.5"
            style={motifBtn}
          >
            {sortDir === "asc" ? "A→Z" : "Z→A"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{background: '#bebebe'}}>
        {movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center" style={{color: '#555555'}}>
            <FileText size={32} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No movies found</p>
            <p className="text-xs mt-1">Add directories in Settings, then click Scan Folders</p>
          </div>
        ) : viewMode === "list" ? (
          visibleMovies.map((movie) => {
            const thumb = posterSrc(movie);
            const isSelected = selectedMovie?.id === movie.id;
            return (
              <div
                key={movie.id}
                onClick={() => onSelect(movie)}
                className="flex items-center gap-2 px-1.5 py-1 cursor-pointer"
                style={isSelected ? {
                  background: '#000080',
                  color: '#ffffff',
                  borderBottom: '1px solid #9090a8',
                } : {
                  background: 'transparent',
                  color: '#000000',
                  borderBottom: '1px solid #d0d0d0',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#adb5c6'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div className="shrink-0 w-8 h-12 overflow-hidden flex items-center justify-center"
                  style={{border: '1px solid #808080', background: '#d0d0d0'}}>
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <FileText size={13} style={{color: '#666666'}} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{fontSize: '11px', color: isSelected ? '#ffffff' : '#000000'}}>
                    {movie.movieData?.title || movie.parsedTitle}
                  </p>
                  <p className="truncate" style={{fontSize: '10px', color: isSelected ? '#ccccff' : '#444444'}}>
                    {movie.movieData?.year || movie.parsedYear || ""}
                  </p>
                  <div className="flex items-center gap-2">
                    {movie.ignored ? (
                      <span className="flex items-center gap-0.5" style={{fontSize: '10px', color: isSelected ? '#ffaa88' : '#884400'}}><EyeOff size={9} /> ignored</span>
                    ) : movie.matched ? (
                      <span className="flex items-center gap-0.5" style={{fontSize: '10px', color: isSelected ? '#88ff88' : '#006600'}}><CheckCircle size={9} /> matched</span>
                    ) : (
                      <span className="flex items-center gap-0.5" style={{fontSize: '10px', color: isSelected ? '#ffcc44' : '#886600'}}><AlertCircle size={9} /> unmatched</span>
                    )}
                    {movie.parts?.length > 1 && (
                      <span style={{fontSize: '10px', color: isSelected ? '#ccaaff' : '#555555'}}>{movie.parts.length} parts</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onIgnore(movie, !movie.ignored); }}
                    className="p-0.5"
                    style={{color: movie.ignored ? '#884400' : '#555555', background: 'transparent'}}
                    title={movie.ignored ? "Unignore" : "Ignore"}
                  >
                    <EyeOff size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSearch(movie); }}
                    className="p-0.5"
                    style={{color: '#555555', background: 'transparent'}}
                    title="Search TMDB"
                  >
                    <Search size={12} />
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
                  className="relative group cursor-pointer flex flex-col"
                  style={isSelected ? {
                    borderTop: '2px solid #ffffff',
                    borderLeft: '2px solid #ffffff',
                    borderBottom: '2px solid #404040',
                    borderRight: '2px solid #404040',
                    outline: '1px solid #000080',
                  } : {
                    borderTop: '2px solid #ffffff',
                    borderLeft: '2px solid #ffffff',
                    borderBottom: '2px solid #404040',
                    borderRight: '2px solid #404040',
                  }}
                >
                  <div className="aspect-[2/3] relative overflow-hidden" style={{background: '#d0d0d0'}}>
                    {thumb ? (
                      <img src={thumb} alt={title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : bg ? (
                      <img src={bg} alt={title} className="w-full h-full object-cover opacity-60" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText size={24} style={{color: '#888888'}} />
                      </div>
                    )}
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full"
                      style={{background: movie.ignored ? '#cc6600' : movie.matched ? '#006600' : '#886600',
                        border: '1px solid #ffffff'}} />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSearch(movie); }}
                        className="p-1"
                        style={{background: '#bebebe', borderTop: '2px solid #ffffff', borderLeft: '2px solid #ffffff', borderBottom: '2px solid #404040', borderRight: '2px solid #404040', color: '#000000'}}
                        title="Search TMDB"
                      >
                        <Search size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onIgnore(movie, !movie.ignored); }}
                        className="p-1"
                        style={{background: '#bebebe', borderTop: '2px solid #ffffff', borderLeft: '2px solid #ffffff', borderBottom: '2px solid #404040', borderRight: '2px solid #404040', color: '#000000'}}
                        title={movie.ignored ? "Unignore" : "Ignore"}
                      >
                        <EyeOff size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="px-1 py-0.5" style={{background: isSelected ? '#000080' : '#adb5c6'}}>
                    <p className="font-medium truncate leading-tight" style={{fontSize: '10px', color: isSelected ? '#ffffff' : '#000000'}}>{title}</p>
                    {movie.movieData?.year || movie.parsedYear ? <p style={{fontSize: '10px', color: isSelected ? '#ccccff' : '#333333'}}>{movie.movieData?.year || movie.parsedYear}</p> : null}
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
