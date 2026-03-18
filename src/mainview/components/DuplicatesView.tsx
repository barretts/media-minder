import React from "react";
import { Copy, HardDrive, Film, Monitor, Volume2, Clock, Zap, Trash2, AlertTriangle, X, EyeOff } from "lucide-react";
import { useState } from "react";
import type { ScannedMovie } from "../types";

const API = "http://localhost:3457";

interface DuplicatesViewProps {
  groups: Record<string, ScannedMovie[]>;
  loading: boolean;
  onRefresh: () => void;
  onDelete: (movieId: string, fileName: string) => Promise<void>;
  onIgnore: (movieId: string, ignored: boolean) => void;
}

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + " MB";
  return bytes + " B";
}

function formatBitrate(bps: number): string {
  if (!bps) return "—";
  if (bps >= 1000000) return (bps / 1000000).toFixed(1) + " Mbps";
  if (bps >= 1000) return (bps / 1000).toFixed(0) + " Kbps";
  return bps + " bps";
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function channelLabel(ch: number): string {
  if (ch === 8) return "7.1";
  if (ch === 6) return "5.1";
  if (ch === 2) return "Stereo";
  if (ch === 1) return "Mono";
  return ch ? `${ch}ch` : "";
}

function posterSrc(movie: ScannedMovie): string | null {
  if (movie.posterPath) return `${API}/api/file?path=${encodeURIComponent(movie.posterPath)}&t=${movie.posterTs ?? 0}`;
  if (movie.movieData?.thumbUrl) return movie.movieData.thumbUrl;
  if (movie.movieData?.posterUrl) return movie.movieData.posterUrl;
  return null;
}

export function DuplicatesView({ groups, loading, onRefresh, onDelete, onIgnore }: DuplicatesViewProps) {
  const groupKeys = Object.keys(groups).sort();
  const [confirmDelete, setConfirmDelete] = useState<{ movieId: string; fileName: string; folderPath: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const resColor = (h: number) => {
    if (h >= 2160) return {background: '#e8d8f8', color: '#440088', border: '1px solid #aa88cc'};
    if (h >= 1080) return {background: '#d8e8f8', color: '#003388', border: '1px solid #8899cc'};
    if (h >= 720) return {background: '#d8f0f8', color: '#004466', border: '1px solid #88aacc'};
    return {background: '#d0d0d0', color: '#444444', border: '1px solid #808080'};
  };

  return (
    <div className="flex-1 overflow-y-auto p-3" style={{background: '#bebebe'}}>
      {/* Title bar */}
      <div className="px-3 py-1.5 mb-3 flex items-center justify-between"
        style={{background: 'linear-gradient(to right, #847bbd, #524a8c)'}}>
        <div className="flex items-center gap-2">
          <Copy size={13} style={{color: '#ffffff'}} />
          <span style={{color: '#ffffff', fontSize: '12px', fontWeight: 'bold'}}>Duplicate Movies</span>
        </div>
        <button onClick={onRefresh} disabled={loading} style={{...mb, opacity: loading ? 0.5 : 1, fontSize: '10px', padding: '1px 8px'}}>
          Refresh
        </button>
      </div>

      <p style={{fontSize: '10px', color: '#555555', marginBottom: '8px'}}>
        Movies with the same title and year found in multiple locations
      </p>

      {groupKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16" style={{color: '#666666'}}>
          <Copy size={32} className="mb-3 opacity-30" />
          <p style={{fontSize: '12px', fontWeight: 'bold'}}>No duplicates found</p>
          <p style={{fontSize: '11px', marginTop: '4px'}}>Scan folders first, then check for duplicates</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupKeys.map((key) => {
            const group = groups[key];
            const poster = posterSrc(group[0]);
            return (
              <div key={key}
                style={{background: '#bebebe', borderTop: '2px solid #ffffff', borderLeft: '2px solid #ffffff', borderBottom: '2px solid #404040', borderRight: '2px solid #404040'}}>
                {/* Group header - purple title bar */}
                <div className="flex items-center gap-2 px-2 py-1"
                  style={{background: 'linear-gradient(to right, #6b6295, #3d3670)'}}>
                  {poster && (
                    <img src={poster} alt="" className="w-6 h-9 object-cover shrink-0"
                      style={{border: '1px solid #ffffff'}} />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate" style={{fontSize: '11px', color: '#ffffff'}}>{key}</h3>
                    <p style={{fontSize: '10px', color: '#ddccff'}}>{group.length} copies found</p>
                  </div>
                </div>

                {/* File detail table */}
                <div className="overflow-x-auto">
                  <table className="w-full" style={{fontSize: '11px', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr style={{background: '#adb5c6', borderBottom: '1px solid #808080'}}>
                        {['File Name','Location','Size','Resolution','Video','Audio','Bitrate','Duration',''].map(h => (
                          <th key={h} className={h === 'Size' || h === 'Bitrate' || h === 'Duration' ? 'text-right' : h === 'Resolution' || h === 'Video' || h === 'Audio' ? 'text-center' : 'text-left'}
                            style={{padding: '2px 6px', fontWeight: 'bold', color: '#000000', fontSize: '10px'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((movie) => {
                        const isBest = group.length > 1 &&
                          group.every((other) =>
                            other.id === movie.id ||
                            (movie.height || 0) > (other.height || 0) ||
                            ((movie.height || 0) === (other.height || 0) && (movie.fileSize || 0) >= (other.fileSize || 0))
                          );
                        return (
                          <tr key={movie.id}
                            style={{background: isBest ? '#e8f8e8' : 'transparent', borderBottom: '1px solid #d0d0d0'}}
                            onMouseEnter={e => (e.currentTarget.style.background = isBest ? '#d8f0d8' : '#d8e8f0')}
                            onMouseLeave={e => (e.currentTarget.style.background = isBest ? '#e8f8e8' : 'transparent')}
                          >
                            <td style={{padding: '3px 6px', maxWidth: '240px'}}>
                              <div className="flex items-center gap-1">
                                <Film size={10} style={{color: '#555555', flexShrink: 0}} />
                                <span className="truncate" style={{color: '#000000'}} title={movie.fileName}>{movie.fileName}</span>
                                {isBest && (
                                  <span className="shrink-0 px-1" style={{fontSize: '9px', background: '#006600', color: '#ffffff', fontWeight: 'bold'}}>BEST</span>
                                )}
                              </div>
                            </td>
                            <td style={{padding: '3px 6px', maxWidth: '200px'}}>
                              <span className="truncate block" style={{color: '#444444', fontSize: '10px'}} title={movie.folderPath}>{movie.folderPath}</span>
                            </td>
                            <td className="text-right" style={{padding: '3px 6px', whiteSpace: 'nowrap'}}>
                              <span className="flex items-center justify-end gap-0.5" style={{color: '#000000'}}>
                                <HardDrive size={9} style={{color: '#666666'}} />
                                {formatSize(movie.fileSize)}
                              </span>
                            </td>
                            <td className="text-center" style={{padding: '3px 6px'}}>
                              <span className="inline-block px-1" style={{fontSize: '10px', fontWeight: 'bold', ...resColor(movie.height || 0)}}>
                                <Monitor size={9} className="inline mr-0.5" />
                                {movie.resolution || '—'}
                              </span>
                            </td>
                            <td className="text-center" style={{padding: '3px 6px', color: '#000000'}}>
                              {movie.videoCodec ? movie.videoCodec.toUpperCase() : '—'}
                            </td>
                            <td className="text-center" style={{padding: '3px 6px'}}>
                              <span className="flex items-center justify-center gap-0.5" style={{color: '#000000'}}>
                                <Volume2 size={9} style={{color: '#666666'}} />
                                {movie.audioCodec ? movie.audioCodec.toUpperCase() : '—'}
                                {movie.audioChannels ? ` ${channelLabel(movie.audioChannels)}` : ''}
                              </span>
                            </td>
                            <td className="text-right" style={{padding: '3px 6px', whiteSpace: 'nowrap', color: '#000000'}}>
                              <span className="flex items-center justify-end gap-0.5">
                                <Zap size={9} style={{color: '#666666'}} />
                                {formatBitrate(movie.bitrate)}
                              </span>
                            </td>
                            <td className="text-right" style={{padding: '3px 6px', whiteSpace: 'nowrap', color: '#000000'}}>
                              <span className="flex items-center justify-end gap-0.5">
                                <Clock size={9} style={{color: '#666666'}} />
                                {formatDuration(movie.duration)}
                              </span>
                            </td>
                            <td style={{padding: '3px 4px'}}>
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  onClick={() => onIgnore(movie.id, !movie.ignored)}
                                  style={{color: movie.ignored ? '#884400' : '#555555', background: 'transparent', cursor: 'pointer', padding: '2px'}}
                                  title={movie.ignored ? 'Unignore' : 'Ignore'}
                                >
                                  <EyeOff size={12} />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete({ movieId: movie.id, fileName: movie.fileName, folderPath: movie.folderPath })}
                                  style={{color: '#660000', background: 'transparent', cursor: 'pointer', padding: '2px'}}
                                  title="Delete this file"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog - Motif style */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background: 'rgba(50,40,80,0.6)'}}>
          <div style={{
            background: '#bebebe',
            borderTop: '2px solid #ffffff',
            borderLeft: '2px solid #ffffff',
            borderBottom: '2px solid #404040',
            borderRight: '2px solid #404040',
            boxShadow: '4px 4px 8px rgba(0,0,0,0.5)',
            width: '400px',
          }}>
            {/* Title bar */}
            <div className="flex items-center justify-between px-2 py-1"
              style={{background: 'linear-gradient(to right, #cc4444, #882222)'}}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={11} style={{color: '#ffffff'}} />
                <span style={{color: '#ffffff', fontSize: '11px', fontWeight: 'bold'}}>Delete Movie File</span>
              </div>
              <button onClick={() => setConfirmDelete(null)} style={{...mb, padding: '1px 5px', fontSize: '10px', background: '#adb5c6'}}>
                <X size={10} />
              </button>
            </div>
            <div className="p-4">
              <p style={{fontSize: '11px', color: '#000000', marginBottom: '8px'}}>
                Permanently delete this file and its companion files (NFO, poster, fanart)?
              </p>
              <div className="p-2" style={{background: '#d0d0d0', borderTop: '2px solid #404040', borderLeft: '2px solid #404040', borderBottom: '2px solid #ffffff', borderRight: '2px solid #ffffff'}}>
                <p className="font-medium break-all" style={{fontSize: '11px', color: '#000000'}}>{confirmDelete.fileName}</p>
                <p className="break-all" style={{fontSize: '10px', color: '#444444', marginTop: '2px'}}>{confirmDelete.folderPath}</p>
              </div>
              <p style={{fontSize: '10px', color: '#880000', marginTop: '6px', fontWeight: 'bold'}}>This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-2 px-4 py-2" style={{borderTop: '1px solid #808080'}}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{...mb, opacity: deleting ? 0.5 : 1}}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try { await onDelete(confirmDelete.movieId, confirmDelete.fileName); }
                  finally { setDeleting(false); setConfirmDelete(null); }
                }}
                disabled={deleting}
                style={{...mb, background: '#ffcccc', color: '#660000', opacity: deleting ? 0.5 : 1}}
              >
                <Trash2 size={11} />
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
