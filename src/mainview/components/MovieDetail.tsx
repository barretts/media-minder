import { Search, Save, Download, Star, Clock, Calendar, Tag, Users, Clapperboard, EyeOff, Eye, Image, X, Film } from "lucide-react";
import type { ScannedMovie } from "../types";

interface MovieDetailProps {
  movie: ScannedMovie | null;
  onSearch: () => void;
  onSaveNfo: () => void;
  onDownloadImages: () => void;
  onIgnore: (ignored: boolean) => void;
  onSelectImages: (tab: "poster" | "fanart") => void;
  onUnset: () => void;
}

export function MovieDetail({ movie, onSearch, onSaveNfo, onDownloadImages, onIgnore, onSelectImages, onUnset }: MovieDetailProps) {
  if (!movie) {
    return (
      <div className="flex flex-1 items-center justify-center text-surface-500">
        <div className="text-center">
          <Clapperboard size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a movie to view details</p>
        </div>
      </div>
    );
  }

  const data = movie.movieData;
  // Prefer locally saved file paths; use mtime timestamp as cache-buster so browser reloads after changes
  const fanartSrc = movie.fanartPath
    ? `http://localhost:3457/api/file?path=${encodeURIComponent(movie.fanartPath)}&t=${movie.fanartTs ?? 0}`
    : data?.fanartUrl;
  const posterSrc = movie.posterPath
    ? `http://localhost:3457/api/file?path=${encodeURIComponent(movie.posterPath)}&t=${movie.posterTs ?? 0}`
    : (data?.thumbUrl || data?.posterUrl);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Fanart Banner */}
      {fanartSrc && (
        <div className="relative h-48 shrink-0 overflow-hidden">
          <img
            src={fanartSrc}
            alt="Fanart"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/50 to-transparent" />
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex gap-5">
          {posterSrc && (
            <img
              src={posterSrc}
              alt="Poster"
              className="w-32 h-48 rounded-lg object-cover shadow-lg shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-surface-50">
              {data?.title || movie.parsedTitle}
            </h2>
            {data?.originalTitle && data.originalTitle !== data.title && (
              <p className="text-sm text-surface-400 mt-0.5">{data.originalTitle}</p>
            )}
            {data?.tagline && (
              <p className="text-sm text-surface-400 italic mt-1">{data.tagline}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-3">
              {data?.rating ? (
                <span className="flex items-center gap-1 text-sm text-amber-400">
                  <Star size={14} fill="currentColor" /> {data.rating.toFixed(1)}
                </span>
              ) : null}
              {(data?.year || movie.parsedYear) && (
                <span className="flex items-center gap-1 text-sm text-surface-400">
                  <Calendar size={14} /> {data?.year || movie.parsedYear}
                </span>
              )}
              {data?.runtime ? (
                <span className="flex items-center gap-1 text-sm text-surface-400">
                  <Clock size={14} /> {data.runtime} min
                </span>
              ) : null}
              {data?.mpaa && (
                <span className="text-xs border border-surface-600 rounded px-1.5 py-0.5 text-surface-400">
                  {data.mpaa}
                </span>
              )}
            </div>

            {data?.genres && data.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {data.genres.map((g) => (
                  <span key={g} className="flex items-center gap-1 text-xs bg-surface-800 text-surface-300 rounded px-2 py-0.5">
                    <Tag size={10} /> {g}
                  </span>
                ))}
              </div>
            )}

            {data?.imdbId && (
              <p className="text-xs text-surface-500 mt-2">
                IMDB: {data.imdbId} &middot; TMDB: {data.tmdbId}
              </p>
            )}

            {/* Ignored banner */}
            {movie.ignored && (
              <div className="flex items-center gap-2 mt-3 rounded-lg bg-red-900/30 border border-red-800/50 px-3 py-2">
                <EyeOff size={14} className="text-red-400" />
                <span className="text-xs text-red-300">This movie is ignored and will be skipped during auto-match</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={onSearch}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Search size={12} /> {data ? "Change Match" : "Search"}
              </button>
              {data && (
                <button
                  onClick={onUnset}
                  className="flex items-center gap-1.5 rounded-lg bg-surface-800 border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-400 hover:bg-red-900/40 hover:text-red-300 hover:border-red-800/50 transition-colors"
                  title="Remove metadata and mark as unmatched"
                >
                  <X size={12} /> Unset
                </button>
              )}
              {data && (
                <>
                  <button
                    onClick={onSaveNfo}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-600 transition-colors"
                  >
                    <Save size={12} /> Save NFO
                  </button>
                  <button
                    onClick={onDownloadImages}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-600 transition-colors"
                  >
                    <Download size={12} /> Download Images
                  </button>
                </>
              )}
              {data && (
                <>
                  <button
                    onClick={() => onSelectImages("poster")}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-600 transition-colors"
                  >
                    <Image size={12} /> Poster
                  </button>
                  <button
                    onClick={() => onSelectImages("fanart")}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-600 transition-colors"
                  >
                    <Image size={12} /> Fanart
                  </button>
                </>
              )}
              <button
                onClick={() => onIgnore(!movie.ignored)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  movie.ignored
                    ? "bg-green-700 text-green-100 hover:bg-green-600"
                    : "bg-red-900/50 text-red-300 hover:bg-red-800/50"
                }`}
              >
                {movie.ignored ? <Eye size={12} /> : <EyeOff size={12} />}
                {movie.ignored ? "Unignore" : "Ignore"}
              </button>
            </div>
          </div>
        </div>

        {/* Plot */}
        {data?.plot && (
          <div>
            <h3 className="text-sm font-semibold text-surface-300 mb-1">Plot</h3>
            <p className="text-sm text-surface-400 leading-relaxed">{data.plot}</p>
          </div>
        )}

        {/* Crew */}
        {data?.directors && data.directors.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-surface-300 mb-1">Directors</h3>
            <p className="text-sm text-surface-400">{data.directors.join(", ")}</p>
          </div>
        )}
        {data?.writers && data.writers.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-surface-300 mb-1">Writers</h3>
            <p className="text-sm text-surface-400">{data.writers.join(", ")}</p>
          </div>
        )}

        {/* Cast */}
        {data?.actors && data.actors.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
              <Users size={14} /> Cast
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {data.actors.slice(0, 12).map((actor) => (
                <div key={actor.name} className="flex items-center gap-2 bg-surface-800/50 rounded-lg p-2">
                  {actor.thumb ? (
                    <img
                      src={actor.thumb}
                      alt={actor.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-700 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-surface-200 truncate">{actor.name}</p>
                    <p className="text-xs text-surface-500 truncate">{actor.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Info */}
        <div className="border-t border-surface-800 pt-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-1">File</h3>
          {movie.parts?.length > 1 ? (
            <div className="space-y-1">
              {movie.parts.map((p) => (
                <div key={p.filePath} className="flex items-center gap-2">
                  <Film size={11} className="text-purple-400 shrink-0" />
                  <span className="text-xs text-purple-300 font-medium w-8">CD{p.partNum}</span>
                  <span className="text-xs text-surface-500 font-mono truncate">{p.fileName}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-surface-500 font-mono break-all">{movie.filePath}</p>
          )}
          <div className="flex gap-4 mt-2 text-xs text-surface-500">
            <span>NFO: {movie.hasNfo ? "Yes" : "No"}</span>
            <span>Poster: {movie.hasPoster ? "Yes" : "No"}</span>
            <span>Fanart: {movie.hasFanart ? "Yes" : "No"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
