import { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import type { ScannedMovie, AppSettings } from "./types";
import { Sidebar } from "./components/Sidebar";
import { MovieList } from "./components/MovieList";
import { MovieDetail } from "./components/MovieDetail";
import { SearchModal } from "./components/SearchModal";
import { ImagePickerModal } from "./components/ImagePickerModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusBar } from "./components/StatusBar";

type View = "movies" | "settings";

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
      setMovies((prev) =>
        prev.map((m) => (m.id === movieId ? result.movie : m))
      );
      if (selectedMovie?.id === movieId) setSelectedMovie(result.movie);
      setStatus(ignored ? `Ignored "${result.movie.parsedTitle}"` : `Unignored "${result.movie.parsedTitle}"`);
    } catch (e: any) {
      setStatus(`Failed: ${e.message}`);
    }
  }, [selectedMovie]);

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
        loading={loading}
        movieCount={movies.length}
        unmatchedCount={movies.filter((m) => !m.hasNfo && !m.matched && !m.ignored).length}
        ignoredCount={movies.filter((m) => m.ignored).length}
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
