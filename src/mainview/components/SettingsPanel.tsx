import React, { useState, useEffect } from "react";
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
  const inset: React.CSSProperties = {
    background: '#ffffff',
    borderTop: '2px solid #404040',
    borderLeft: '2px solid #404040',
    borderBottom: '2px solid #ffffff',
    borderRight: '2px solid #ffffff',
    color: '#000000',
    fontSize: '11px',
    padding: '3px 6px',
    outline: 'none',
  };
  const sectionHeader: React.CSSProperties = {
    background: 'linear-gradient(to right, #847bbd, #524a8c)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 8px',
    marginBottom: '6px',
  };
  const panel: React.CSSProperties = {
    background: '#bebebe',
    borderTop: '2px solid #404040',
    borderLeft: '2px solid #404040',
    borderBottom: '2px solid #ffffff',
    borderRight: '2px solid #ffffff',
    padding: '8px',
    marginBottom: '12px',
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-2xl" style={{background: '#bebebe'}}>
      {/* Window title bar */}
      <div className="px-3 py-1.5 mb-4 flex items-center gap-2" style={{background: 'linear-gradient(to right, #847bbd, #524a8c)'}}>
        <span style={{color: '#ffffff', fontSize: '12px', fontWeight: 'bold'}}>Settings</span>
      </div>

      {/* Title Cleanup Strings */}
      <section style={{marginBottom: '16px'}}>
        <div style={sectionHeader}>Title Cleanup Strings</div>
        <div style={panel}>
          <p style={{fontSize: '10px', color: '#444444', marginBottom: '6px'}}>Strings stripped from parsed movie titles before searching TMDB/IMDB</p>
          <div className="space-y-1 mb-2">
            {local.cleanupStrings.map((s) => (
              <div key={s} className="flex items-center gap-2 px-2 py-1"
                style={{background: '#d0d0d0', borderTop: '1px solid #ffffff', borderLeft: '1px solid #ffffff', borderBottom: '1px solid #808080', borderRight: '1px solid #808080'}}>
                <span className="flex-1 font-mono" style={{fontSize: '11px', color: '#000000'}}>{s}</span>
                <button
                  onClick={() => {
                    const updated = { ...local, cleanupStrings: local.cleanupStrings.filter((c) => c !== s) };
                    setLocal(updated);
                    onSaveImmediate?.(updated);
                  }}
                  style={{color: '#660000', background: 'transparent', cursor: 'pointer'}}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {local.cleanupStrings.length === 0 && (
              <p style={{fontSize: '11px', color: '#666666', fontStyle: 'italic'}}>No cleanup strings added yet</p>
            )}
          </div>
          <div className="flex gap-1">
            <input type="text" value={newCleanup}
              onChange={(e) => setNewCleanup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = newCleanup.trim();
                  if (val && !local.cleanupStrings.includes(val)) {
                    const updated = { ...local, cleanupStrings: [...local.cleanupStrings, val] };
                    setLocal(updated); setNewCleanup(""); onSaveImmediate?.(updated);
                  }
                }
              }}
              placeholder='e.g. from ISO'
              className="flex-1 font-mono focus:outline-none"
              style={inset}
            />
            <button
              onClick={() => {
                const val = newCleanup.trim();
                if (val && !local.cleanupStrings.includes(val)) {
                  const updated = { ...local, cleanupStrings: [...local.cleanupStrings, val] };
                  setLocal(updated); setNewCleanup(""); onSaveImmediate?.(updated);
                }
              }}
              disabled={!newCleanup.trim()}
              style={{...mb, opacity: !newCleanup.trim() ? 0.5 : 1}}
            >
              <Plus size={11} /> Add
            </button>
          </div>
        </div>
      </section>

      {/* Movie Directories */}
      <section style={{marginBottom: '16px'}}>
        <div style={sectionHeader}>Movie Directories</div>
        <div style={panel}>
          <div className="space-y-1 mb-2">
            {local.movieDirectories.map((dir) => (
              <div key={dir} className="flex items-center gap-2 px-2 py-1"
                style={{background: '#d0d0d0', borderTop: '1px solid #ffffff', borderLeft: '1px solid #ffffff', borderBottom: '1px solid #808080', borderRight: '1px solid #808080'}}>
                <FolderOpen size={12} style={{color: '#555555', flexShrink: 0}} />
                <span className="flex-1 font-mono truncate" style={{fontSize: '11px', color: '#000000'}}>{dir}</span>
                <button onClick={() => removeDirectory(dir)} style={{color: '#660000', background: 'transparent', cursor: 'pointer'}}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {local.movieDirectories.length === 0 && (
              <p style={{fontSize: '11px', color: '#666666', fontStyle: 'italic'}}>No directories added yet</p>
            )}
          </div>
          <div className="flex gap-1">
            <input type="text" value={newDir}
              onChange={(e) => setNewDir(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDirectory()}
              placeholder="C:\Movies or /mnt/movies"
              className="flex-1 focus:outline-none"
              style={inset}
            />
            <button onClick={addDirectory} disabled={!newDir.trim()}
              style={{...mb, opacity: !newDir.trim() ? 0.5 : 1}}>
              <Plus size={11} /> Add
            </button>
          </div>
        </div>
      </section>

      {/* Naming Convention */}
      <section style={{marginBottom: '16px'}}>
        <div style={sectionHeader}>Naming Convention</div>
        <div style={panel}>
          <p style={{fontSize: '11px', color: '#000000'}}>
            <strong>Filename-based</strong> — NFO and images named after the movie file
          </p>
          <p className="font-mono" style={{fontSize: '10px', color: '#444444', marginTop: '4px'}}>MovieName.nfo, MovieName-poster.jpg, MovieName-fanart.jpg</p>
        </div>
      </section>

      {/* Auto-Save + Download Options */}
      <section style={{marginBottom: '16px'}}>
        <div style={sectionHeader}>Options</div>
        <div style={panel}>
          <p style={{fontSize: '10px', color: '#444444', marginBottom: '6px'}}>Automatically save NFO files and images when movies are matched</p>
          <div className="space-y-2">
            {[
              { key: "autoSaveNfo" as const, label: "Auto-save NFO files" },
              { key: "autoSaveImages" as const, label: "Auto-save images (poster, fanart)" },
              { key: "downloadPoster" as const, label: "Download Posters" },
              { key: "downloadFanart" as const, label: "Download Fanart/Backdrops" },
              { key: "downloadActorThumbs" as const, label: "Download Actor Thumbnails" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={local[key]}
                  onChange={(e) => setLocal({ ...local, [key]: e.target.checked })}
                  style={{width: '13px', height: '13px', cursor: 'pointer'}}
                />
                <span style={{fontSize: '11px', color: '#000000'}}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <button onClick={() => onSave(local)} style={mb}>
        <Save size={11} /> Save Settings
      </button>
    </div>
  );
}
