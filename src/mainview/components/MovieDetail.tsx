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
      <div className="flex flex-1 items-center justify-center" style={{color: '#2d7a96'}}>
        <div className="text-center">
          <Clapperboard size={48} className="mx-auto mb-3 opacity-20" />
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

  const solBtn = {
    primary: {background: 'linear-gradient(to bottom, #1a7a9a, #0d4d66)', color: '#cce8f0', border: '1px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0'} as React.CSSProperties,
    secondary: {background: 'linear-gradient(to bottom, #144960, #0d3347)', color: '#7ab8cc', border: '1px solid #0a3d52', borderTopColor: '#1d7fa0', borderLeftColor: '#1d7fa0'} as React.CSSProperties,
    danger: {background: 'linear-gradient(to bottom, #4a1a00, #2a0e00)', color: '#e07c30', border: '1px solid #a05520', borderTopColor: '#d07840', borderLeftColor: '#d07840'} as React.CSSProperties,
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto" style={{background: '#071e2e'}}>
      {/* Fanart Banner */}
      {fanartSrc && (
        <div className="relative h-44 shrink-0 overflow-hidden">
          <img
            src={fanartSrc}
            alt="Fanart"
            className="w-full h-full object-cover opacity-60"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0" style={{background: 'linear-gradient(to top, #071e2e 0%, #071e2e20 60%, transparent 100%)'}} />
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex gap-4">
          {posterSrc && (
            <img
              src={posterSrc}
              alt="Poster"
              className="w-28 h-40 object-cover shrink-0"
              style={{border: '2px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0'}}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold" style={{color: '#48cae4', textShadow: '0 1px 3px #040f18'}}>
              {data?.title || movie.parsedTitle}
            </h2>
            {data?.originalTitle && data.originalTitle !== data.title && (
              <p className="text-xs mt-0.5" style={{color: '#4e9ab4'}}>{data.originalTitle}</p>
            )}
            {data?.tagline && (
              <p className="text-xs italic mt-1" style={{color: '#4e9ab4'}}>{data.tagline}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2">
              {data?.rating ? (
                <span className="flex items-center gap-1 text-xs" style={{color: '#c8a020'}}>
                  <Star size={11} fill="currentColor" /> {data.rating.toFixed(1)}
                </span>
              ) : null}
              {(data?.year || movie.parsedYear) && (
                <span className="flex items-center gap-1 text-xs" style={{color: '#7ab8cc'}}>
                  <Calendar size={11} /> {data?.year || movie.parsedYear}
                </span>
              )}
              {data?.runtime ? (
                <span className="flex items-center gap-1 text-xs" style={{color: '#7ab8cc'}}>
                  <Clock size={11} /> {data.runtime} min
                </span>
              ) : null}
              {data?.mpaa && (
                <span className="text-xs px-1.5 py-0.5" style={{color: '#7ab8cc', border: '1px solid #1d5f78'}}>
                  {data.mpaa}
                </span>
              )}
            </div>

            {data?.genres && data.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {data.genres.map((g) => (
                  <span key={g} className="flex items-center gap-1 text-xs px-1.5 py-0.5"
                    style={{background: '#0d3347', color: '#7ab8cc', border: '1px solid #1d5f78'}}>
                    <Tag size={9} /> {g}
                  </span>
                ))}
              </div>
            )}

            {data?.imdbId && (
              <p className="text-xs mt-2" style={{color: '#2d7a96'}}>
                IMDB: {data.imdbId} &middot; TMDB: {data.tmdbId}
              </p>
            )}

            {/* Ignored banner */}
            {movie.ignored && (
              <div className="flex items-center gap-2 mt-2 px-2 py-1.5"
                style={{background: '#1a0e00', border: '1px solid #a05520', borderTopColor: '#d07840', borderLeftColor: '#d07840'}}>
                <EyeOff size={12} style={{color: '#e07c30'}} />
                <span className="text-xs" style={{color: '#c06020'}}>Ignored — skipped during auto-match</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button onClick={onSearch} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium" style={solBtn.primary}>
                <Search size={11} /> {data ? "Change Match" : "Search"}
              </button>
              {data && (
                <button onClick={onUnset} className="flex items-center gap-1 px-2.5 py-1 text-xs" style={solBtn.danger} title="Remove metadata">
                  <X size={11} /> Unset
                </button>
              )}
              {data && (
                <>
                  <button onClick={onSaveNfo} className="flex items-center gap-1 px-2.5 py-1 text-xs" style={solBtn.secondary}>
                    <Save size={11} /> Save NFO
                  </button>
                  <button onClick={onDownloadImages} className="flex items-center gap-1 px-2.5 py-1 text-xs" style={solBtn.secondary}>
                    <Download size={11} /> Images
                  </button>
                  <button onClick={() => onSelectImages("poster")} className="flex items-center gap-1 px-2.5 py-1 text-xs" style={solBtn.secondary}>
                    <Image size={11} /> Poster
                  </button>
                  <button onClick={() => onSelectImages("fanart")} className="flex items-center gap-1 px-2.5 py-1 text-xs" style={solBtn.secondary}>
                    <Image size={11} /> Fanart
                  </button>
                </>
              )}
              <button
                onClick={() => onIgnore(!movie.ignored)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs"
                style={movie.ignored ? solBtn.secondary : solBtn.danger}
              >
                {movie.ignored ? <Eye size={11} /> : <EyeOff size={11} />}
                {movie.ignored ? "Unignore" : "Ignore"}
              </button>
            </div>
          </div>
        </div>

        {/* Plot */}
        {data?.plot && (
          <div style={{borderTop: '1px solid #0a3d52', paddingTop: '12px'}}>
            <h3 className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{color: '#48cae4'}}>Plot</h3>
            <p className="text-xs leading-relaxed" style={{color: '#7ab8cc'}}>{data.plot}</p>
          </div>
        )}

        {/* Crew */}
        {data?.directors && data.directors.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-0.5 uppercase tracking-wider" style={{color: '#48cae4'}}>Director</h3>
            <p className="text-xs" style={{color: '#7ab8cc'}}>{data.directors.join(", ")}</p>
          </div>
        )}
        {data?.writers && data.writers.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-0.5 uppercase tracking-wider" style={{color: '#48cae4'}}>Writers</h3>
            <p className="text-xs" style={{color: '#7ab8cc'}}>{data.writers.join(", ")}</p>
          </div>
        )}

        {/* Cast */}
        {data?.actors && data.actors.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-1.5 flex items-center gap-1 uppercase tracking-wider" style={{color: '#48cae4'}}>
              <Users size={11} /> Cast
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
              {data.actors.slice(0, 12).map((actor) => (
                <div key={actor.name} className="flex items-center gap-2 p-1.5"
                  style={{background: '#0d3347', border: '1px solid #0a3d52', borderTopColor: '#1d7fa0', borderLeftColor: '#1d7fa0'}}>
                  {actor.thumb ? (
                    <img src={actor.thumb} alt={actor.name}
                      className="w-7 h-7 object-cover shrink-0"
                      style={{border: '1px solid #1d5f78'}}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-7 h-7 shrink-0" style={{background: '#071e2e', border: '1px solid #1d5f78'}} />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{color: '#cce8f0'}}>{actor.name}</p>
                    <p className="text-xs truncate" style={{color: '#4e9ab4'}}>{actor.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Info */}
        <div style={{borderTop: '1px solid #0a3d52', paddingTop: '12px'}}>
          <h3 className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{color: '#48cae4'}}>File</h3>
          {movie.parts?.length > 1 ? (
            <div className="space-y-1">
              {movie.parts.map((p) => (
                <div key={p.filePath} className="flex items-center gap-2">
                  <Film size={10} style={{color: '#7ab8cc'}} className="shrink-0" />
                  <span className="text-xs font-medium w-8" style={{color: '#7ab8cc'}}>CD{p.partNum}</span>
                  <span className="text-xs font-mono truncate" style={{color: '#4e9ab4'}}>{p.fileName}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono break-all" style={{color: '#4e9ab4'}}>{movie.filePath}</p>
          )}
          <div className="flex gap-4 mt-1.5 text-xs" style={{color: '#2d7a96'}}>
            <span>NFO: {movie.hasNfo ? <span style={{color: '#2d9e6e'}}>Yes</span> : "No"}</span>
            <span>Poster: {movie.hasPoster ? <span style={{color: '#2d9e6e'}}>Yes</span> : "No"}</span>
            <span>Fanart: {movie.hasFanart ? <span style={{color: '#2d9e6e'}}>Yes</span> : "No"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
