import React from "react";
import { Copy, HardDrive, Film, Monitor, Volume2, Clock, Zap, Trash2, AlertTriangle, X, EyeOff, Search, ArrowUpDown, Eye } from "lucide-react";
import { useState, useMemo } from "react";
import type { ScannedMovie } from "../types";

import { convertFileSrc } from "@tauri-apps/api/core";

interface DuplicatesViewProps {
  groups: Record<string, ScannedMovie[]>;
  ignoredGroups: Set<string>;
  loading: boolean;
  onRefresh: () => void;
  onDelete: (movieId: string, fileName: string) => Promise<void>;
  onIgnore: (movieId: string, ignored: boolean) => void;
  onIgnoreGroup: (groupKey: string, ignored: boolean) => void;
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
  if (movie.posterPath) return `${convertFileSrc(movie.posterPath)}?t=${movie.posterTs ?? 0}`;
  if (movie.movieData?.thumbUrl) return movie.movieData.thumbUrl;
  if (movie.movieData?.posterUrl) return movie.movieData.posterUrl;
  return null;
}

type SortKey = "title" | "count" | "size";

export function DuplicatesView({ groups, ignoredGroups, loading, onRefresh, onDelete, onIgnore, onIgnoreGroup }: DuplicatesViewProps) {
  const [confirmDelete, setConfirmDelete] = useState<{ movieId: string; fileName: string; folderPath: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showIgnoredGroups, setShowIgnoredGroups] = useState(false);

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filteredKeys = useMemo(() => {
    let keys = Object.keys(groups);
    if (!showIgnoredGroups) keys = keys.filter(k => !ignoredGroups.has(k));
    if (search.trim()) {
      const q = search.toLowerCase();
      keys = keys.filter(k => k.toLowerCase().includes(q));
    }
    keys.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.localeCompare(b);
      else if (sortKey === "count") cmp = (groups[a]?.length ?? 0) - (groups[b]?.length ?? 0);
      else if (sortKey === "size") {
        const sizeOf = (k: string) => (groups[k] ?? []).reduce((s, m) => s + (m.fileSize ?? 0), 0);
        cmp = sizeOf(a) - sizeOf(b);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return keys;
  }, [groups, ignoredGroups, search, sortKey, sortDir, showIgnoredGroups]);

  const sortBtn = (key: SortKey, label: string) => (
    <button onClick={() => toggleSort(key)} style={{
      ...mb,
      background: sortKey === key ? '#adb5c6' : '#bebebe',
      fontSize: '10px', padding: '1px 7px',
    }}>
      {label}
      <ArrowUpDown size={9} style={{opacity: sortKey === key ? 1 : 0.4}} />
      {sortKey === key && <span style={{fontSize: '9px'}}>{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );

  return (
    <div className="flex flex-col h-full" style={{background: '#bebebe'}}>
      {/* Title bar */}
      <div className="px-3 py-1.5 flex items-center justify-between shrink-0"
        style={{background: 'linear-gradient(to right, #847bbd, #524a8c)'}}>
        <div className="flex items-center gap-2">
          <Copy size={13} style={{color: '#ffffff'}} />
          <span style={{color: '#ffffff', fontSize: '12px', fontWeight: 'bold'}}>Duplicate Movies</span>
          <span style={{color: '#ddccff', fontSize: '10px'}}>({filteredKeys.length} groups)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowIgnoredGroups(v => !v)}
            style={{...mb, fontSize: '10px', padding: '1px 7px', background: showIgnoredGroups ? '#adb5c6' : '#bebebe'}}
            title={showIgnoredGroups ? "Hide ignored groups" : "Show ignored groups"}
          >
            {showIgnoredGroups ? <Eye size={10} /> : <EyeOff size={10} />}
            {showIgnoredGroups ? "Showing ignored" : `Ignored (${ignoredGroups.size})`}
          </button>
          <button onClick={onRefresh} disabled={loading} style={{...mb, opacity: loading ? 0.5 : 1, fontSize: '10px', padding: '1px 8px'}}>
            Refresh
          </button>
        </div>
      </div>

      {/* Search + Sort toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{borderBottom: '1px solid #808080', background: '#d4d0d0'}}>
        <div className="flex items-center gap-1 flex-1" style={{
          background: '#ffffff',
          borderTop: '2px solid #404040', borderLeft: '2px solid #404040',
          borderBottom: '2px solid #ffffff', borderRight: '2px solid #ffffff',
          padding: '1px 4px',
        }}>
          <Search size={11} style={{color: '#666666', flexShrink: 0}} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by title..."
            style={{border: 'none', outline: 'none', background: 'transparent', fontSize: '11px', color: '#000000', width: '100%'}}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', color: '#666666'}}>
              <X size={10} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span style={{fontSize: '10px', color: '#555555'}}>Sort:</span>
          {sortBtn("title", "Title")}
          {sortBtn("count", "Count")}
          {sortBtn("size", "Size")}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{color: '#666666'}}>
            <Copy size={32} className="mb-3 opacity-30" />
            <p style={{fontSize: '12px', fontWeight: 'bold'}}>
              {search ? "No matches found" : "No duplicates found"}
            </p>
            <p style={{fontSize: '11px', marginTop: '4px'}}>
              {search ? `No groups match "${search}"` : "Scan folders first, then check for duplicates"}
            </p>
            {!search && ignoredGroups.size > 0 && !showIgnoredGroups && (
              <button onClick={() => setShowIgnoredGroups(true)} style={{...mb, marginTop: '8px', fontSize: '11px'}}>
                <Eye size={11} /> Show {ignoredGroups.size} ignored group{ignoredGroups.size !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredKeys.map((key) => {
              const group = groups[key] ?? [];
              const poster = group.length > 0 ? posterSrc(group[0]) : null;
              const isGroupIgnored = ignoredGroups.has(key);
              const totalSize = group.reduce((s, m) => s + (m.fileSize ?? 0), 0);
              return (
                <div key={key}
                  style={{
                    background: isGroupIgnored ? '#d8d8d8' : '#bebebe',
                    borderTop: '2px solid #ffffff', borderLeft: '2px solid #ffffff',
                    borderBottom: '2px solid #404040', borderRight: '2px solid #404040',
                    opacity: isGroupIgnored ? 0.7 : 1,
                  }}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-2 py-1"
                    style={{background: isGroupIgnored
                      ? 'linear-gradient(to right, #706870, #4a3f4a)'
                      : 'linear-gradient(to right, #6b6295, #3d3670)'}}>
                    {poster && (
                      <img src={poster} alt="" className="w-6 h-9 object-cover shrink-0"
                        style={{border: '1px solid #ffffff', opacity: isGroupIgnored ? 0.5 : 1}} />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate" style={{fontSize: '11px', color: '#ffffff'}}>{key}</h3>
                      <p style={{fontSize: '10px', color: '#ddccff'}}>
                        {group.length} copies · {formatSize(totalSize)} total
                        {isGroupIgnored && <span style={{marginLeft: '6px', color: '#ffccaa'}}>— duplicates ignored</span>}
                      </p>
                    </div>
                    {/* Ignore group toggle */}
                    <button
                      onClick={() => onIgnoreGroup(key, !isGroupIgnored)}
                      title={isGroupIgnored ? "Re-enable duplicate detection for this title" : "Ignore duplicates for this title"}
                      style={{
                        ...mb,
                        fontSize: '10px', padding: '1px 7px',
                        background: isGroupIgnored ? '#c8a870' : '#bebebe',
                        color: isGroupIgnored ? '#440000' : '#000000',
                        flexShrink: 0,
                      }}
                    >
                      {isGroupIgnored ? <Eye size={10} /> : <EyeOff size={10} />}
                      {isGroupIgnored ? "Un-ignore" : "Ignore group"}
                    </button>
                  </div>

                  {/* File detail table — hide when group is ignored */}
                  {!isGroupIgnored && (
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
                                    {isBest && <span className="shrink-0 px-1" style={{fontSize: '9px', background: '#006600', color: '#ffffff', fontWeight: 'bold'}}>BEST</span>}
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
                                      title={movie.ignored ? 'Unignore file' : 'Ignore file'}
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background: 'rgba(50,40,80,0.6)'}}>
          <div style={{
            background: '#bebebe',
            borderTop: '2px solid #ffffff', borderLeft: '2px solid #ffffff',
            borderBottom: '2px solid #404040', borderRight: '2px solid #404040',
            boxShadow: '4px 4px 8px rgba(0,0,0,0.5)',
            width: '400px',
          }}>
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
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{...mb, opacity: deleting ? 0.5 : 1}}>Cancel</button>
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
