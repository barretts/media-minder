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

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
            <Copy size={20} className="text-amber-400" />
            Duplicate Movies
          </h2>
          <p className="text-xs text-surface-500 mt-1">
            Movies with the same title and year found in different locations
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg bg-surface-800 border border-surface-700 px-3 py-1.5 text-xs text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {groupKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-surface-500">
          <Copy size={40} className="mb-4 opacity-30" />
          <p className="text-sm font-medium">No duplicates found</p>
          <p className="text-xs mt-1">Scan folders first, then check for duplicates</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupKeys.map((key) => {
            const group = groups[key];
            const poster = posterSrc(group[0]);
            return (
              <div key={key} className="rounded-xl border border-surface-700 bg-surface-900/60 overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-surface-800/50 border-b border-surface-700">
                  {poster && (
                    <img src={poster} alt="" className="w-8 h-12 rounded object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-surface-100 truncate">{key}</h3>
                    <p className="text-xs text-amber-400 mt-0.5">{group.length} copies found</p>
                  </div>
                </div>

                {/* File detail table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-surface-500 border-b border-surface-800">
                        <th className="text-left px-4 py-2 font-medium">File Name</th>
                        <th className="text-left px-4 py-2 font-medium">Location</th>
                        <th className="text-right px-4 py-2 font-medium">Size</th>
                        <th className="text-center px-4 py-2 font-medium">Resolution</th>
                        <th className="text-center px-4 py-2 font-medium">Video</th>
                        <th className="text-center px-4 py-2 font-medium">Audio</th>
                        <th className="text-right px-4 py-2 font-medium">Bitrate</th>
                        <th className="text-right px-4 py-2 font-medium">Duration</th>
                        <th className="px-4 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((movie, i) => {
                        // Highlight the "best" file (highest resolution, then largest)
                        const isBest = group.length > 1 &&
                          group.every((other) =>
                            other.id === movie.id ||
                            (movie.height || 0) > (other.height || 0) ||
                            ((movie.height || 0) === (other.height || 0) && (movie.fileSize || 0) >= (other.fileSize || 0))
                          );
                        return (
                          <tr
                            key={movie.id}
                            className={`border-b border-surface-800/50 transition-colors hover:bg-surface-800/30 ${
                              isBest ? "bg-emerald-900/10" : ""
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Film size={12} className="text-surface-600 shrink-0" />
                                <span className="text-surface-200 truncate max-w-[280px]" title={movie.fileName}>
                                  {movie.fileName}
                                </span>
                                {isBest && (
                                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-400 font-medium">
                                    BEST
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-surface-400 truncate max-w-[240px] block" title={movie.folderPath}>
                                {movie.folderPath}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-surface-200 flex items-center justify-end gap-1">
                                <HardDrive size={11} className="text-surface-600" />
                                {formatSize(movie.fileSize)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                (movie.height || 0) >= 2160
                                  ? "bg-purple-600/20 text-purple-300"
                                  : (movie.height || 0) >= 1080
                                  ? "bg-blue-600/20 text-blue-300"
                                  : (movie.height || 0) >= 720
                                  ? "bg-cyan-600/20 text-cyan-300"
                                  : "bg-surface-700 text-surface-400"
                              }`}>
                                <Monitor size={10} className="inline mr-1" />
                                {movie.resolution || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center text-surface-300">
                              {movie.videoCodec ? movie.videoCodec.toUpperCase() : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="text-surface-300 flex items-center justify-center gap-1">
                                <Volume2 size={10} className="text-surface-600" />
                                {movie.audioCodec ? movie.audioCodec.toUpperCase() : "—"}
                                {movie.audioChannels ? ` ${channelLabel(movie.audioChannels)}` : ""}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-surface-300 flex items-center justify-end gap-1">
                                <Zap size={10} className="text-surface-600" />
                                {formatBitrate(movie.bitrate)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-surface-300 flex items-center justify-end gap-1">
                                <Clock size={10} className="text-surface-600" />
                                {formatDuration(movie.duration)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  onClick={() => onIgnore(movie.id, !movie.ignored)}
                                  className={`rounded p-1.5 transition-colors ${
                                    movie.ignored
                                      ? "text-red-400 hover:bg-surface-700 hover:text-surface-300"
                                      : "text-surface-500 hover:text-amber-400 hover:bg-amber-900/20"
                                  }`}
                                  title={movie.ignored ? "Unignore" : "Ignore (keep file, skip NFO/images)"}
                                >
                                  <EyeOff size={13} />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete({ movieId: movie.id, fileName: movie.fileName, folderPath: movie.folderPath })}
                                  className="rounded p-1.5 text-surface-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                                  title="Delete this file"
                                >
                                  <Trash2 size={13} />
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

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-700">
              <div className="rounded-full bg-red-600/20 p-2">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-surface-100">Delete Movie File</h3>
                <p className="text-xs text-surface-500 mt-0.5">This action cannot be undone</p>
              </div>
              <button
                onClick={() => setConfirmDelete(null)}
                className="text-surface-500 hover:text-surface-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-surface-300">
                Are you sure you want to permanently delete this file and its companion files (NFO, poster, fanart)?
              </p>
              <div className="mt-3 rounded-lg bg-surface-800 px-3 py-2">
                <p className="text-xs font-medium text-surface-200 break-all">{confirmDelete.fileName}</p>
                <p className="text-xs text-surface-500 break-all mt-0.5">{confirmDelete.folderPath}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-surface-800">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-xs font-medium text-surface-300 bg-surface-800 hover:bg-surface-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete(confirmDelete.movieId, confirmDelete.fileName);
                  } finally {
                    setDeleting(false);
                    setConfirmDelete(null);
                  }
                }}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 size={12} />
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
