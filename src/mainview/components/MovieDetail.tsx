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

  const mb: React.CSSProperties = {
    background: '#bebebe',
    borderTop: '2px solid #ffffff',
    borderLeft: '2px solid #ffffff',
    borderBottom: '2px solid #404040',
    borderRight: '2px solid #404040',
    color: '#000000',
    cursor: 'pointer',
    fontSize: '11px',
    padding: '2px 8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto" style={{background: '#bebebe'}}>
      {/* Fanart Banner */}
      {fanartSrc && (
        <div className="relative h-36 shrink-0 overflow-hidden">
          <img
            src={fanartSrc}
            alt="Fanart"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0" style={{background: 'linear-gradient(to top, rgba(190,190,190,0.9) 0%, transparent 60%)'}} />
        </div>
      )}

      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex gap-3">
          {posterSrc && (
            <img
              src={posterSrc}
              alt="Poster"
              className="w-24 h-36 object-cover shrink-0"
              style={{borderTop: '2px solid #ffffff', borderLeft: '2px solid #ffffff', borderBottom: '2px solid #404040', borderRight: '2px solid #404040'}}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            {/* Title bar style header */}
            <div className="px-2 py-1 mb-2" style={{background: 'linear-gradient(to right, #847bbd, #524a8c)', color: '#ffffff'}}>
              <h2 className="font-bold truncate" style={{fontSize: '12px'}}>
                {data?.title || movie.parsedTitle}
              </h2>
            </div>
            {data?.originalTitle && data.originalTitle !== data.title && (
              <p style={{fontSize: '11px', color: '#333333'}}>{data.originalTitle}</p>
            )}
            {data?.tagline && (
              <p className="italic" style={{fontSize: '11px', color: '#444444'}}>{data.tagline}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-1">
              {data?.rating ? (
                <span className="flex items-center gap-1" style={{fontSize: '11px', color: '#664400'}}>
                  <Star size={10} fill="currentColor" /> {data.rating.toFixed(1)}
                </span>
              ) : null}
              {(data?.year || movie.parsedYear) && (
                <span className="flex items-center gap-1" style={{fontSize: '11px', color: '#333333'}}>
                  <Calendar size={10} /> {data?.year || movie.parsedYear}
                </span>
              )}
              {data?.runtime ? (
                <span className="flex items-center gap-1" style={{fontSize: '11px', color: '#333333'}}>
                  <Clock size={10} /> {data.runtime} min
                </span>
              ) : null}
              {data?.mpaa && (
                <span className="px-1" style={{fontSize: '10px', color: '#333333', border: '1px solid #808080', background: '#d0d0d0'}}>
                  {data.mpaa}
                </span>
              )}
            </div>

            {data?.genres && data.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {data.genres.map((g) => (
                  <span key={g} className="flex items-center gap-0.5 px-1"
                    style={{fontSize: '10px', background: '#adb5c6', color: '#000000', border: '1px solid #808080'}}>
                    <Tag size={8} /> {g}
                  </span>
                ))}
              </div>
            )}

            {data?.imdbId && (
              <p style={{fontSize: '10px', color: '#555555', marginTop: '4px'}}>
                IMDB: {data.imdbId} &middot; TMDB: {data.tmdbId}
              </p>
            )}

            {movie.ignored && (
              <div className="flex items-center gap-1 mt-2 px-2 py-1"
                style={{background: '#ffeecc', border: '1px solid #cc8800', fontSize: '11px', color: '#664400'}}>
                <EyeOff size={11} />
                <span>Ignored — skipped during auto-match</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-1 mt-2">
              <button onClick={onSearch} style={mb}><Search size={10} /> {data ? "Change Match" : "Search"}</button>
              {data && <button onClick={onUnset} style={{...mb, background: '#ffcccc', color: '#660000'}} title="Remove metadata"><X size={10} /> Unset</button>}
              {data && (
                <>
                  <button onClick={onSaveNfo} style={mb}><Save size={10} /> Save NFO</button>
                  <button onClick={onDownloadImages} style={mb}><Download size={10} /> Images</button>
                  <button onClick={() => onSelectImages("poster")} style={mb}><Image size={10} /> Poster</button>
                  <button onClick={() => onSelectImages("fanart")} style={mb}><Image size={10} /> Fanart</button>
                </>
              )}
              <button onClick={() => onIgnore(!movie.ignored)} style={mb}>
                {movie.ignored ? <Eye size={10} /> : <EyeOff size={10} />}
                {movie.ignored ? "Unignore" : "Ignore"}
              </button>
            </div>
          </div>
        </div>

        {/* Plot */}
        {data?.plot && (
          <div style={{borderTop: '1px solid #808080', paddingTop: '8px'}}>
            <div className="px-1 py-0.5 mb-1" style={{background: '#adb5c6', fontSize: '10px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Plot</div>
            <p style={{fontSize: '11px', color: '#000000', lineHeight: '1.5'}}>{data.plot}</p>
          </div>
        )}

        {/* Crew */}
        {((data?.directors?.length ?? 0) > 0 || (data?.writers?.length ?? 0) > 0) && (
          <div style={{borderTop: '1px solid #808080', paddingTop: '8px'}}>
            {data?.directors && data.directors.length > 0 && (
              <div className="mb-1">
                <span style={{fontSize: '10px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase'}}>Director: </span>
                <span style={{fontSize: '11px', color: '#333333'}}>{data.directors.join(", ")}</span>
              </div>
            )}
            {data?.writers && data.writers.length > 0 && (
              <div>
                <span style={{fontSize: '10px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase'}}>Writers: </span>
                <span style={{fontSize: '11px', color: '#333333'}}>{data.writers.join(", ")}</span>
              </div>
            )}
          </div>
        )}

        {/* Cast */}
        {data?.actors && data.actors.length > 0 && (
          <div style={{borderTop: '1px solid #808080', paddingTop: '8px'}}>
            <div className="px-1 py-0.5 mb-1 flex items-center gap-1" style={{background: '#adb5c6', fontSize: '10px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase'}}>
              <Users size={10} /> Cast
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-1">
              {data.actors.slice(0, 12).map((actor) => (
                <div key={actor.name} className="flex items-center gap-1.5 p-1"
                  style={{background: '#d0d0d0', borderTop: '1px solid #ffffff', borderLeft: '1px solid #ffffff', borderBottom: '1px solid #808080', borderRight: '1px solid #808080'}}>
                  {actor.thumb ? (
                    <img src={actor.thumb} alt={actor.name}
                      className="w-6 h-6 object-cover shrink-0"
                      style={{border: '1px solid #808080'}}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-6 h-6 shrink-0" style={{background: '#adb5c6', border: '1px solid #808080'}} />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{fontSize: '10px', color: '#000000'}}>{actor.name}</p>
                    <p className="truncate" style={{fontSize: '10px', color: '#444444'}}>{actor.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Info */}
        <div style={{borderTop: '1px solid #808080', paddingTop: '8px'}}>
          <div className="px-1 py-0.5 mb-1" style={{background: '#adb5c6', fontSize: '10px', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase'}}>File</div>
          {movie.parts?.length > 1 ? (
            <div className="space-y-0.5">
              {movie.parts.map((p) => (
                <div key={p.filePath} className="flex items-center gap-1">
                  <Film size={9} style={{color: '#555555'}} className="shrink-0" />
                  <span className="font-medium" style={{fontSize: '10px', color: '#333333', minWidth: '28px'}}>CD{p.partNum}</span>
                  <span className="font-mono truncate" style={{fontSize: '10px', color: '#444444'}}>{p.fileName}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono break-all" style={{fontSize: '10px', color: '#444444'}}>{movie.filePath}</p>
          )}
          <div className="flex gap-3 mt-1" style={{fontSize: '10px', color: '#333333'}}>
            <span>NFO: {movie.hasNfo ? <span style={{color: '#006600'}}>Yes</span> : <span style={{color: '#660000'}}>No</span>}</span>
            <span>Poster: {movie.hasPoster ? <span style={{color: '#006600'}}>Yes</span> : <span style={{color: '#660000'}}>No</span>}</span>
            <span>Fanart: {movie.hasFanart ? <span style={{color: '#006600'}}>Yes</span> : <span style={{color: '#660000'}}>No</span>}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
