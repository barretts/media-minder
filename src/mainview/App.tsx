import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  const handleScan = useCallback(async () => {
    setLoading(true);
    setStatus("Scanning directories...");
    try {
      const result = await api.scan();
      setMovies(result.movies);
      setSelectedMovie(null);
      const unmatched = result.movies.filter((m: ScannedMovie) => !m.hasNfo && !m.matched);
      if (unmatched.length === 0) {
        setStatus(`Found ${result.total} movies — all already matched`);
        setLoading(false);
        return;
      }
      // Fetch duplicates after scan
      api.getDuplicates().then((d) => { setDuplicateGroups(d.groups || {}); setDuplicateCount(d.totalDuplicates || 0); }).catch(() => {});
      setStatus(`Found ${result.total} movies. Auto-matching ${unmatched.length} via TMDB...`);
      const matchResult = await api.autoMatch();
      setMovies(matchResult.movies);
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
      setStatus(`Scan failed: ${e.message}`);
    }
    setLoading(false);
  }, []);

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
            onIgnore={async (movieId: string, ignored: boolean) => {
              await handleIgnore(movieId, ignored);
              // Refresh duplicates to reflect new state
              const d = await api.getDuplicates();
              setDuplicateGroups(d.groups || {});
              setDuplicateCount(d.totalDuplicates || 0);
            }}
            onDelete={async (movieId: string, fileName: string) => {
              try {
                const result = await api.deleteMovieFile(movieId);
                setMovies((prev) => prev.filter((m) => m.id !== movieId));
                setStatus(`Deleted "${fileName}" (${result.deleted?.length ?? 0} files removed)`);
                // Refresh duplicates
                const d = await api.getDuplicates();
                setDuplicateGroups(d.groups || {});
                setDuplicateCount(d.totalDuplicates || 0);
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
