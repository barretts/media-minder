import { Search, CheckCircle, AlertCircle, FileText, EyeOff, X, LayoutList, LayoutGrid } from "lucide-react";
import { useState } from "react";
import type { ScannedMovie } from "../types";

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
}

export function MovieList({ movies, selectedMovie, onSelect, onSearch, onIgnore, filter, onFilterChange, loading, viewMode, onViewModeChange }: MovieListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const visibleMovies = searchQuery.trim()
    ? movies.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          (m.movieData?.title || m.parsedTitle).toLowerCase().includes(q) ||
          m.fileName.toLowerCase().includes(q)
        );
      })
    : movies;

  return (
    <div className={`flex flex-col border-r border-surface-700 bg-surface-900/50 ${viewMode === "grid" ? "w-full" : "w-80"}`}>
      <div className="p-3 border-b border-surface-700 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter movies…"
              className="w-full rounded-lg bg-surface-800 border border-surface-700 pl-8 pr-7 py-1.5 text-xs text-surface-100 placeholder-surface-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => onViewModeChange(viewMode === "list" ? "grid" : "list")}
            className="shrink-0 rounded-lg bg-surface-800 border border-surface-700 px-2 text-surface-400 hover:text-surface-200 transition-colors"
            title={viewMode === "list" ? "Switch to poster grid" : "Switch to list"}
          >
            {viewMode === "list" ? <LayoutGrid size={14} /> : <LayoutList size={14} />}
          </button>
        </div>
        <div className="flex gap-1">
          {(["all", "unmatched", "matched", "ignored"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-surface-800 text-surface-400 hover:text-surface-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-500 p-6 text-center">
            <FileText size={32} className="mb-3 opacity-50" />
            <p className="text-sm font-medium">No movies found</p>
            <p className="text-xs mt-1">Add directories in Settings, then click Scan Folders</p>
          </div>
        ) : viewMode === "list" ? (
          visibleMovies.map((movie) => {
            const thumb = posterSrc(movie);
            return (
              <div
                key={movie.id}
                onClick={() => onSelect(movie)}
                className={`flex items-center gap-3 p-2 cursor-pointer border-b border-surface-800 transition-colors ${
                  selectedMovie?.id === movie.id
                    ? "bg-blue-600/10 border-l-2 border-l-blue-500"
                    : "hover:bg-surface-800/50 border-l-2 border-l-transparent"
                }`}
              >
                {/* Poster thumbnail */}
                <div className="shrink-0 w-9 h-14 rounded overflow-hidden bg-surface-800 flex items-center justify-center">
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <FileText size={14} className="text-surface-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100 truncate">
                    {movie.movieData?.title || movie.parsedTitle}
                  </p>
                  <p className="text-xs text-surface-500 truncate mt-0.5">
                    {movie.parsedYear || ""}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {movie.ignored ? (
                      <span className="flex items-center gap-1 text-xs text-red-400"><EyeOff size={10} /> ignored</span>
                    ) : movie.matched ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={10} /> matched</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-400"><AlertCircle size={10} /> unmatched</span>
                    )}
                    {movie.parts?.length > 1 && (
                      <span className="text-xs text-purple-400">{movie.parts.length} parts</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onIgnore(movie, !movie.ignored); }}
                    className={`rounded p-1.5 transition-colors ${
                      movie.ignored
                        ? "text-red-400 hover:bg-surface-700 hover:text-surface-300"
                        : "text-surface-500 hover:bg-surface-700 hover:text-red-400"
                    }`}
                    title={movie.ignored ? "Unignore" : "Ignore"}
                  >
                    <EyeOff size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSearch(movie); }}
                    className="rounded p-1.5 text-surface-400 hover:bg-surface-700 hover:text-blue-400 transition-colors"
                    title="Search TMDB"
                  >
                    <Search size={14} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          /* Poster grid view */
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 p-3">
            {visibleMovies.map((movie) => {
              const bg = fanartSrc(movie);
              const thumb = posterSrc(movie);
              const title = movie.movieData?.title || movie.parsedTitle;
              const isSelected = selectedMovie?.id === movie.id;
              return (
                <div
                  key={movie.id}
                  onClick={() => onSelect(movie)}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden flex flex-col transition-all ${
                    isSelected ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-surface-950" : "hover:ring-1 hover:ring-surface-500"
                  }`}
                >
                  {/* Poster */}
                  <div className="aspect-[2/3] bg-surface-800 relative overflow-hidden">
                    {thumb ? (
                      <img src={thumb} alt={title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : bg ? (
                      <img src={bg} alt={title} className="w-full h-full object-cover opacity-40" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText size={24} className="text-surface-600" />
                      </div>
                    )}
                    {/* Status dot */}
                    <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                      movie.ignored ? "bg-red-500" : movie.matched ? "bg-emerald-500" : "bg-amber-500"
                    }`} />
                    {/* Hover overlay with action buttons */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSearch(movie); }}
                        className="rounded-full bg-blue-600 p-2 text-white hover:bg-blue-700 transition-colors"
                        title="Search TMDB"
                      >
                        <Search size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onIgnore(movie, !movie.ignored); }}
                        className={`rounded-full p-2 text-white transition-colors ${
                          movie.ignored ? "bg-surface-600 hover:bg-surface-500" : "bg-red-700 hover:bg-red-600"
                        }`}
                        title={movie.ignored ? "Unignore" : "Ignore"}
                      >
                        <EyeOff size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Title bar */}
                  <div className="bg-surface-900 px-1.5 py-1">
                    <p className="text-xs font-medium text-surface-200 truncate leading-tight">{title}</p>
                    {movie.parsedYear ? <p className="text-xs text-surface-500">{movie.parsedYear}</p> : null}
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
