import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "./api";
import type { ScannedMovie, AppSettings, SortField, SortDir } from "./types";
import { Sidebar } from "./components/Sidebar";
import { MovieList } from "./components/MovieList";
import { MovieDetail } from "./components/MovieDetail";
import { SearchModal } from "./components/SearchModal";
import { ImagePickerModal } from "./components/ImagePickerModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusBar } from "./components/StatusBar";
import { DuplicatesView } from "./components/DuplicatesView";

type View = "movies" | "settings" | "duplicates";

function App() {
  const [view, setView] = useState<View>("movies");
  const [movies, setMovies] = useState<ScannedMovie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<ScannedMovie | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [searchModal, setSearchModal] = useState<{ movie: ScannedMovie } | null>(null);
  const [imagePickerModal, setImagePickerModal] = useState<{ movie: ScannedMovie; tab: "poster" | "fanart" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [filter, setFilter] = useState<"all" | "unmatched" | "matched" | "ignored">("all");
  const [showIgnored, setShowIgnored] = useState(false);
  const [listViewMode, setListViewMode] = useState<"list" | "grid">("list");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [duplicateGroups, setDuplicateGroups] = useState<Record<string, ScannedMovie[]>>({});
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [ignoredDuplicateGroups, setIgnoredDuplicateGroups] = useState<Set<string>>(new Set());

  const loadDuplicates = useCallback(async () => {
    try {
      const d = await api.getDuplicates();
      setDuplicateGroups(d.groups || {});
      setDuplicateCount(d.totalDuplicates || 0);
    } catch {}
  }, []);

  const handleScan = useCallback(async (background = false) => {
    setLoading(true);
    setStatus(background ? "Refreshing library from disk..." : "Scanning directories...");
    if (!background) {
      setMovies([]);
      setSelectedMovie(null);
    }
    let progressCount = 0;

    // Listen for progressive scan results
    const unlisten = await listen<{ movies: ScannedMovie[] }>("scan-progress", (event) => {
      const batch = event.payload.movies;
      progressCount += batch.length;
      if (background) {
        setStatus(`Refreshing... ${progressCount} files scanned`);
        return;
      }
      setMovies(prev => {
        const all = [...prev, ...batch];
        // Union-find duplicate grouping matching backend logic
        const candidates = all.filter(m => !m.ignored);
        const parent = candidates.map((_, i) => i);
        const find = (x: number): number => { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; };
        const union = (x: number, y: number) => { const rx = find(x), ry = find(y); if (rx !== ry) parent[rx] = ry; };
        const tmdbMap = new Map<number, number>();
        const imdbMap = new Map<string, number>();
        const titleMap = new Map<string, number>();
        candidates.forEach((m, i) => {
          const tk = `${(m.parsedTitle ?? "").toLowerCase().trim()}|${m.parsedYear ?? "?"}`;
          if (titleMap.has(tk)) union(i, titleMap.get(tk)!); else titleMap.set(tk, i);
          if (m.tmdbId && m.tmdbId > 0) {
            if (tmdbMap.has(m.tmdbId)) union(i, tmdbMap.get(m.tmdbId)!); else tmdbMap.set(m.tmdbId, i);
          }
          if (m.imdbId) {
            if (imdbMap.has(m.imdbId)) union(i, imdbMap.get(m.imdbId)!); else imdbMap.set(m.imdbId, i);
          }
        });
        const rootGroups = new Map<number, ScannedMovie[]>();
        candidates.forEach((m, i) => {
          const root = find(i);
          if (!rootGroups.has(root)) rootGroups.set(root, []);
          rootGroups.get(root)!.push(m);
        });
        const dupes: Record<string, ScannedMovie[]> = {};
        let dupeTotal = 0;
        rootGroups.forEach(g => {
          if (g.length < 2) return;
          const title = g.find(m => m.movieData?.title)?.movieData?.title ?? g[0].parsedTitle;
          const year = g.find(m => m.parsedYear)?.parsedYear ?? "?";
          const key = `${title} (${year})`;
          dupes[key] = g;
          dupeTotal += g.length;
        });
        setDuplicateGroups(dupes);
        setDuplicateCount(dupeTotal);
        return all;
      });
      setStatus(`Scanning... ${progressCount} movies found`);
    });

    try {
      const result = await api.scan();
      unlisten();
      setMovies(result.movies);
      await loadDuplicates();
      const unmatched = result.movies.filter((m: ScannedMovie) => !m.hasNfo && !m.matched);
      if (unmatched.length === 0) {
        setStatus(background ? `Library refreshed: ${result.total} movies cached` : `Found ${result.total} movies — all already matched`);
        setLoading(false);
        return;
      }
      setStatus(`Found ${result.total} movies. Auto-matching ${unmatched.length} via TMDB...`);
      const matchResult = await api.autoMatch();
      setMovies(matchResult.movies);
      await loadDuplicates();
      const succeeded = matchResult.results.filter((r: any) => r.success).length;
      const failedIds = matchResult.results.filter((r: any) => !r.success).map((r: any) => r.movieId);
      const failedTitles = matchResult.movies
        .filter((m: ScannedMovie) => failedIds.includes(m.id))
        .map((m: ScannedMovie) => m.parsedTitle)
        .join(", ");
      const failedMsg = failedIds.length
        ? ` — no match: ${failedTitles}`
        : "";
      setStatus(`Done: ${succeeded} matched out of ${unmatched.length}${failedMsg}`);
    } catch (e: any) {
      unlisten();
      setStatus(`Scan failed: ${e.message ?? e}`);
    }
    setLoading(false);
  }, [loadDuplicates]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [s, movieResult] = await Promise.all([api.getSettings(), api.getMovies()]);
        if (cancelled) return;
        setSettings(s);
        setMovies(movieResult.movies || []);
        setStatus((movieResult.movies?.length ?? 0) > 0 ? `Loaded ${movieResult.movies.length} cached movies` : "No cached movies yet");
        if (s.ignoredDuplicateGroups?.length) {
          setIgnoredDuplicateGroups(new Set<string>(s.ignoredDuplicateGroups));
        }
        await loadDuplicates();
        void handleScan(true);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setStatus("Failed to load cached library");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handleScan, loadDuplicates]);

  const handleAutoMatch = useCallback(async () => {
    setLoading(true);
    setStatus("Auto-matching movies via TMDB scraping...");
    try {
      const result = await api.autoMatch();
      setMovies(result.movies);
      const succeeded = result.results.filter((r: any) => r.success).length;
      const failed = result.results.filter((r: any) => !r.success).length;
      setStatus(`Auto-match complete: ${succeeded} matched, ${failed} failed`);
    } catch (e: any) {
      setStatus(`Auto-match failed: ${e.message}`);
    }
    setLoading(false);
  }, []);

  const handleProcess = useCallback(async (movieId: string, tmdbId: number) => {
    setLoading(true);
    setStatus("Processing movie via TMDB...");
    try {
      const result = await api.processMovie(movieId, tmdbId);
      setMovies((prev) =>
        prev.map((m) => (m.id === movieId ? result.movie : m))
      );
      setSelectedMovie(result.movie);
      setSearchModal(null);
      setStatus(`Saved NFO and images for "${result.movie.movieData?.title}"`);
    } catch (e: any) {
      setStatus(`Process failed: ${e.message}`);
    }
    setLoading(false);
  }, []);

  const handleImdbProcess = useCallback(async (movieId: string, imdbId: string) => {
    setLoading(true);
    setStatus("Processing movie via IMDB...");
    try {
      const result = await api.imdbProcess(movieId, imdbId);
      setMovies((prev) =>
        prev.map((m) => (m.id === movieId ? result.movie : m))
      );
      setSelectedMovie(result.movie);
      setSearchModal(null);
      setStatus(`Saved NFO and images for "${result.movie.movieData?.title}" (IMDB)`);
    } catch (e: any) {
      setStatus(`IMDB process failed: ${e.message}`);
    }
    setLoading(false);
  }, []);

  const handleIgnore = useCallback(async (movieId: string, ignored: boolean) => {
    try {
      const result = await api.ignoreMovie(movieId, ignored);
      setMovies((prev) => {
        const updated = prev.map((m) => (m.id === movieId ? result.movie : m));
        // Auto-select next movie when ignoring the currently selected one
        if (ignored && selectedMovie?.id === movieId) {
          const visible = updated.filter((m) => {
            if (m.ignored && !showIgnored && filter !== "ignored") return false;
            if (filter === "unmatched") return !m.hasNfo && !m.matched && !m.ignored;
            if (filter === "matched") return m.matched;
            if (filter === "ignored") return m.ignored;
            return true;
          });
          // Apply same sort as MovieList
          visible.sort((a, b) => {
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
          const curIdx = visible.findIndex((m) => m.id === movieId);
          const next = visible[curIdx + 1] || visible[curIdx - 1] || null;
          setSelectedMovie(next);
        } else if (selectedMovie?.id === movieId) {
          setSelectedMovie(result.movie);
        }
        return updated;
      });
      setStatus(ignored ? `Ignored "${result.movie.parsedTitle}"` : `Unignored "${result.movie.parsedTitle}"`);
    } catch (e: any) {
      setStatus(`Failed: ${e.message}`);
    }
  }, [selectedMovie, showIgnored, filter, sortField, sortDir]);

  const handleUnset = useCallback(async () => {
    if (!selectedMovie) return;
    try {
      const result = await api.unsetMovie(selectedMovie.id);
      setMovies((prev) => prev.map((m) => (m.id === selectedMovie.id ? result.movie : m)));
      setSelectedMovie(result.movie);
      const count = result.deleted?.length ?? 0;
      setStatus(`Unset "${selectedMovie.parsedTitle}" — deleted ${count} file${count !== 1 ? "s" : ""}`);
    } catch (e: any) {
      setStatus(`Failed: ${e.message}`);
    }
  }, [selectedMovie]);

  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await api.saveSettings(newSettings);
      setSettings(newSettings);
      setStatus("Settings saved");
    } catch (e: any) {
      setStatus(`Failed to save settings: ${e.message}`);
    }
  }, []);

  const filteredMovies = movies.filter((m) => {
    if (m.ignored && !showIgnored && filter !== "ignored") return false;
    if (filter === "unmatched") return !m.hasNfo && !m.matched && !m.ignored;
    if (filter === "matched") return m.matched;
    if (filter === "ignored") return m.ignored;
    return true;
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        view={view}
        onViewChange={setView}
        onScan={handleScan}
        onAutoMatch={handleAutoMatch}
        onProbeAll={async () => {
          setLoading(true);
          setStatus("Probing files with ffprobe...");
          try {
            const result = await api.probeAll();
            setStatus(`Probe complete: ${result.probed} probed, ${result.skipped} skipped, ${result.failed} failed`);
          } catch (e: any) {
            setStatus(`Probe failed: ${e.message}`);
          }
          setLoading(false);
        }}
        loading={loading}
        movieCount={movies.length}
        unmatchedCount={movies.filter((m) => !m.hasNfo && !m.matched && !m.ignored).length}
        ignoredCount={movies.filter((m) => m.ignored).length}
        duplicateCount={duplicateCount}
        showIgnored={showIgnored}
        onToggleShowIgnored={() => setShowIgnored((v) => !v)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {view === "movies" ? (
          <div className="flex flex-1 overflow-hidden">
            <MovieList
              movies={filteredMovies}
              selectedMovie={selectedMovie}
              onSelect={setSelectedMovie}
              onSearch={(movie) => setSearchModal({ movie })}
              onIgnore={(movie, ignored) => handleIgnore(movie.id, ignored)}
              filter={filter}
              onFilterChange={setFilter}
              loading={loading}
              viewMode={listViewMode}
              onViewModeChange={setListViewMode}
              sortField={sortField}
              sortDir={sortDir}
              onSortChange={(f, d) => { setSortField(f); setSortDir(d); }}
            />
            {listViewMode === "list" && <MovieDetail
              movie={selectedMovie}
              onSearch={() => selectedMovie && setSearchModal({ movie: selectedMovie })}
              onSaveNfo={async () => {
                if (!selectedMovie) return;
                try {
                  await api.saveNfo(selectedMovie.id);
                  setStatus(`NFO saved for "${selectedMovie.parsedTitle}"`);
                } catch (e: any) {
                  setStatus(`Failed: ${e.message}`);
                }
              }}
              onDownloadImages={async () => {
                if (!selectedMovie) return;
                try {
                  await api.downloadImages(selectedMovie.id);
                  setStatus(`Images downloaded for "${selectedMovie.parsedTitle}"`);
                } catch (e: any) {
                  setStatus(`Failed: ${e.message}`);
                }
              }}
              onIgnore={(ignored: boolean) => {
                if (selectedMovie) handleIgnore(selectedMovie.id, ignored);
              }}
              onSelectImages={(tab: "poster" | "fanart") => {
                if (selectedMovie) setImagePickerModal({ movie: selectedMovie, tab });
              }}
              onUnset={handleUnset}
            />}
          </div>
        ) : view === "duplicates" ? (
          <DuplicatesView
            groups={duplicateGroups}
            ignoredGroups={ignoredDuplicateGroups}
            loading={loading}
            onRefresh={async () => {
              setLoading(true);
              try {
                const d = await api.getDuplicates();
                setDuplicateGroups(d.groups || {});
                setDuplicateCount(d.totalDuplicates || 0);
                setStatus(`Found ${Object.keys(d.groups || {}).length} duplicate groups`);
              } catch (e: any) {
                setStatus(`Failed: ${e.message}`);
              }
              setLoading(false);
            }}
            onIgnoreGroup={(groupKey: string, ignored: boolean) => {
              setIgnoredDuplicateGroups(prev => {
                const next = new Set(prev);
                if (ignored) next.add(groupKey); else next.delete(groupKey);
                api.setIgnoredDuplicateGroups([...next]).catch(console.error);
                return next;
              });
            }}
            onIgnore={(movieId: string, ignored: boolean) => {
              // Optimistic: remove from groups immediately
              setDuplicateGroups(prev => {
                const next: Record<string, ScannedMovie[]> = {};
                let total = 0;
                for (const [key, group] of Object.entries(prev)) {
                  const filtered = group.filter(m => m.id !== movieId);
                  if (filtered.length >= 2) {
                    next[key] = filtered;
                    total += filtered.length;
                  }
                }
                setDuplicateCount(total);
                return next;
              });
              // Fire backend in background
              handleIgnore(movieId, ignored);
            }}
            onDelete={async (movieId: string, fileName: string) => {
              // Optimistic: remove from groups immediately
              setDuplicateGroups(prev => {
                const next: Record<string, ScannedMovie[]> = {};
                let total = 0;
                for (const [key, group] of Object.entries(prev)) {
                  const filtered = group.filter(m => m.id !== movieId);
                  if (filtered.length >= 2) {
                    next[key] = filtered;
                    total += filtered.length;
                  }
                }
                setDuplicateCount(total);
                return next;
              });
              try {
                const result = await api.deleteMovieFile(movieId);
                setMovies((prev) => prev.filter((m) => m.id !== movieId));
                setStatus(`Deleted "${fileName}" (${result.deleted?.length ?? 0} files removed)`);
              } catch (e: any) {
                setStatus(`Delete failed: ${e.message}`);
              }
            }}
          />
        ) : (
          <SettingsPanel
            settings={settings}
            onSave={handleSaveSettings}
            onSaveImmediate={handleSaveSettings}
          />
        )}

        <StatusBar status={status} loading={loading} />
      </div>

      {searchModal && (
        <SearchModal
          movie={searchModal.movie}
          onClose={() => setSearchModal(null)}
          onSelect={(tmdbId: number) => handleProcess(searchModal.movie.id, tmdbId)}
          onSelectImdb={(imdbId: string) => handleImdbProcess(searchModal.movie.id, imdbId)}
          loading={loading}
          cleanupStrings={settings?.cleanupStrings ?? []}
        />
      )}
      {imagePickerModal && (
        <ImagePickerModal
          movie={imagePickerModal.movie}
          initialTab={imagePickerModal.tab}
          onClose={() => setImagePickerModal(null)}
          onSaved={(updatedMovie) => {
            setMovies((prev) => prev.map((m) => (m.id === updatedMovie.id ? updatedMovie : m)));
            setSelectedMovie(updatedMovie);
            setStatus(`Saved ${imagePickerModal.tab} for "${updatedMovie.parsedTitle}"`);
          }}
        />
      )}
    </div>
  );
}

export default App;
