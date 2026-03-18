import { Film, Settings, FolderSearch, Zap, Loader2, EyeOff } from "lucide-react";

interface SidebarProps {
  view: "movies" | "settings";
  onViewChange: (view: "movies" | "settings") => void;
  onScan: () => void;
  onAutoMatch: () => void;
  loading: boolean;
  movieCount: number;
  unmatchedCount: number;
  ignoredCount: number;
  showIgnored: boolean;
  onToggleShowIgnored: () => void;
}

export function Sidebar({ view, onViewChange, onScan, onAutoMatch, loading, movieCount, unmatchedCount, ignoredCount, showIgnored, onToggleShowIgnored }: SidebarProps) {
  return (
    <div className="flex w-56 flex-col bg-surface-900 border-r border-surface-700">
      <div className="p-4 border-b border-surface-700">
        <h1 className="text-lg font-bold text-blue-400 tracking-tight">MediaMinder</h1>
        <p className="text-xs text-surface-400 mt-0.5">Movie Library Manager</p>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        <button
          onClick={() => onViewChange("movies")}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            view === "movies"
              ? "bg-blue-600/20 text-blue-400"
              : "text-surface-300 hover:bg-surface-800 hover:text-surface-100"
          }`}
        >
          <Film size={16} />
          <span>Movies</span>
          {movieCount > 0 && (
            <span className="ml-auto text-xs bg-surface-700 px-1.5 py-0.5 rounded">
              {movieCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onViewChange("settings")}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            view === "settings"
              ? "bg-blue-600/20 text-blue-400"
              : "text-surface-300 hover:bg-surface-800 hover:text-surface-100"
          }`}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </nav>

      <div className="p-3 space-y-2 border-t border-surface-700">
        <div className="flex items-center justify-between">
          {unmatchedCount > 0 && (
            <div className="text-xs text-amber-400 px-2 py-1 bg-amber-400/10 rounded">
              {unmatchedCount} unmatched
            </div>
          )}
          {ignoredCount > 0 && (
            <button
              onClick={onToggleShowIgnored}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
                showIgnored
                  ? "bg-red-900/40 text-red-300"
                  : "bg-surface-800 text-surface-500 hover:text-surface-300"
              }`}
              title={showIgnored ? "Hide ignored movies" : "Show ignored movies"}
            >
              <EyeOff size={11} />
              {ignoredCount} ignored
            </button>
          )}
        </div>
        <button
          onClick={onScan}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <FolderSearch size={14} />}
          Scan Folders
        </button>
        <button
          onClick={onAutoMatch}
          disabled={loading || unmatchedCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Auto-Match All
        </button>
      </div>
    </div>
  );
}
