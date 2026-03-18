import { useState, useEffect } from "react";
import { Save, Plus, Trash2, FolderOpen, X } from "lucide-react";
import type { AppSettings } from "../types";

interface SettingsPanelProps {
  settings: AppSettings | null;
  onSave: (settings: AppSettings) => void;
  onSaveImmediate?: (settings: AppSettings) => void;
}

export function SettingsPanel({ settings, onSave, onSaveImmediate }: SettingsPanelProps) {
  const [local, setLocal] = useState<AppSettings>({
    movieDirectories: ["G:\\movies"],
    namingConvention: "filename",
    downloadPoster: true,
    downloadFanart: true,
    downloadActorThumbs: false,
    autoSaveNfo: true,
    autoSaveImages: true,
    language: "en-US",
    cleanupStrings: [],
  });
  const [newDir, setNewDir] = useState("");
  const [newCleanup, setNewCleanup] = useState("");

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  const addDirectory = () => {
    const dir = newDir.trim();
    if (dir && !local.movieDirectories.includes(dir)) {
      const updated = { ...local, movieDirectories: [...local.movieDirectories, dir] };
      setLocal(updated);
      setNewDir("");
      onSaveImmediate?.(updated);
    }
  };

  const removeDirectory = (dir: string) => {
    const updated = { ...local, movieDirectories: local.movieDirectories.filter((d) => d !== dir) };
    setLocal(updated);
    onSaveImmediate?.(updated);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-surface-100 mb-6">Settings</h2>

      {/* Title Cleanup Strings */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-surface-300 mb-1 uppercase tracking-wider">Title Cleanup Strings</h3>
        <p className="text-xs text-surface-500 mb-3">These strings are stripped from parsed movie titles before searching TMDB/IMDB</p>
        <div className="space-y-2 mb-3">
          {local.cleanupStrings.map((s) => (
            <div key={s} className="flex items-center gap-2 bg-surface-800 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-surface-200 font-mono">{s}</span>
              <button
                onClick={() => {
                  const updated = { ...local, cleanupStrings: local.cleanupStrings.filter((c) => c !== s) };
                  setLocal(updated);
                  onSaveImmediate?.(updated);
                }}
                className="shrink-0 text-surface-500 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {local.cleanupStrings.length === 0 && (
            <p className="text-sm text-surface-500 italic">No cleanup strings added yet</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCleanup}
            onChange={(e) => setNewCleanup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = newCleanup.trim();
                if (val && !local.cleanupStrings.includes(val)) {
                  const updated = { ...local, cleanupStrings: [...local.cleanupStrings, val] };
                  setLocal(updated);
                  setNewCleanup("");
                  onSaveImmediate?.(updated);
                }
              }
            }}
            placeholder='e.g.  from ISO'
            className="flex-1 rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={() => {
              const val = newCleanup.trim();
              if (val && !local.cleanupStrings.includes(val)) {
                const updated = { ...local, cleanupStrings: [...local.cleanupStrings, val] };
                setLocal(updated);
                setNewCleanup("");
                onSaveImmediate?.(updated);
              }
            }}
            disabled={!newCleanup.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-2 text-sm text-surface-200 hover:bg-surface-600 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </section>

      {/* Movie Directories */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Movie Directories</h3>
        <div className="space-y-2 mb-3">
          {local.movieDirectories.map((dir) => (
            <div key={dir} className="flex items-center gap-2 bg-surface-800 rounded-lg px-3 py-2">
              <FolderOpen size={14} className="text-surface-400 shrink-0" />
              <span className="flex-1 text-sm text-surface-200 font-mono truncate">{dir}</span>
              <button
                onClick={() => removeDirectory(dir)}
                className="shrink-0 text-surface-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {local.movieDirectories.length === 0 && (
            <p className="text-sm text-surface-500 italic">No directories added yet</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newDir}
            onChange={(e) => setNewDir(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDirectory()}
            placeholder="C:\Movies or /mnt/movies"
            className="flex-1 rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={addDirectory}
            disabled={!newDir.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-2 text-sm text-surface-200 hover:bg-surface-600 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </section>

      {/* Naming Convention */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Naming Convention</h3>
        <div className="rounded-lg border border-surface-700 bg-surface-800 px-4 py-3">
          <p className="text-sm text-surface-200">
            <span className="font-medium text-blue-400">Filename-based</span> — NFO and images are named after the movie file
          </p>
          <p className="text-xs text-surface-500 mt-1 font-mono">MovieName.nfo, MovieName-poster.jpg, MovieName-fanart.jpg</p>
        </div>
      </section>

      {/* Auto-Save Options */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Auto-Save</h3>
        <p className="text-xs text-surface-500 mb-3">Automatically save NFO files and images when movies are matched</p>
        <div className="space-y-3">
          {[
            { key: "autoSaveNfo" as const, label: "Auto-save NFO files" },
            { key: "autoSaveImages" as const, label: "Auto-save images (poster, fanart)" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={local[key]}
                onChange={(e) => setLocal({ ...local, [key]: e.target.checked })}
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-surface-200">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Download Options */}
      <section className="mb-8">
        <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Download Options</h3>
        <div className="space-y-3">
          {[
            { key: "downloadPoster" as const, label: "Download Posters" },
            { key: "downloadFanart" as const, label: "Download Fanart/Backdrops" },
            { key: "downloadActorThumbs" as const, label: "Download Actor Thumbnails" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={local[key]}
                onChange={(e) => setLocal({ ...local, [key]: e.target.checked })}
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-surface-200">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Save */}
      <button
        onClick={() => onSave(local)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        <Save size={14} /> Save Settings
      </button>
    </div>
  );
}
