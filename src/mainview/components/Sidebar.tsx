import { Film, Settings, FolderSearch, Zap, Loader2, EyeOff, Copy, ScanSearch } from "lucide-react";

interface SidebarProps {
  view: "movies" | "settings" | "duplicates";
  onViewChange: (view: "movies" | "settings" | "duplicates") => void;
  onScan: () => void;
  onAutoMatch: () => void;
  onProbeAll: () => void;
  loading: boolean;
  movieCount: number;
  unmatchedCount: number;
  ignoredCount: number;
  duplicateCount: number;
  showIgnored: boolean;
  onToggleShowIgnored: () => void;
}

export function Sidebar({ view, onViewChange, onScan, onAutoMatch, onProbeAll, loading, movieCount, unmatchedCount, ignoredCount, duplicateCount, showIgnored, onToggleShowIgnored }: SidebarProps) {
  return (
    <div className="flex w-56 flex-col bg-surface-800 border-r-2 border-r-sol-borderdark border-t-0" style={{borderRight: '2px solid #0a3d52', boxShadow: 'inset -2px 0 0 #3aa0c0'}}>
      <div className="px-4 py-3 border-b-2" style={{borderBottom: '2px solid #0a3d52', boxShadow: 'inset 0 -2px 0 #3aa0c0', background: 'linear-gradient(to bottom, #1a6580, #0d3347)'}}>
        <h1 className="text-base font-bold tracking-tight" style={{color: '#48cae4', textShadow: '0 1px 2px #040f18'}}>MediaMinder</h1>
        <p className="text-xs mt-0.5" style={{color: '#4e9ab4'}}>Movie Library Manager</p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {(["movies", "duplicates", "settings"] as const).map((v) => {
          const Icon = v === "movies" ? Film : v === "duplicates" ? Copy : Settings;
          const label = v === "movies" ? "Movies" : v === "duplicates" ? "Duplicates" : "Settings";
          const badge = v === "movies" ? movieCount : v === "duplicates" ? duplicateCount : 0;
          const isActive = view === v;
          return (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors"
              style={isActive ? {
                background: 'linear-gradient(to bottom, #0d3347, #1a6580)',
                color: '#48cae4',
                border: '1px solid #0a3d52',
                borderTopColor: '#3aa0c0',
                borderLeftColor: '#3aa0c0',
              } : {
                background: 'transparent',
                color: '#7ab8cc',
                border: '1px solid transparent',
              }}
            >
              <Icon size={15} />
              <span>{label}</span>
              {badge > 0 && (
                <span className="ml-auto text-xs px-1.5 py-0.5" style={{background: '#0d3347', color: '#48cae4', border: '1px solid #1d7fa0'}}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2 space-y-1.5 border-t-2" style={{borderTop: '2px solid #0a3d52', boxShadow: 'inset 0 2px 0 #3aa0c0'}}>
        <div className="flex items-center justify-between pb-1">
          {unmatchedCount > 0 && (
            <div className="text-xs px-2 py-0.5" style={{color: '#e07c30', background: '#1a0e00', border: '1px solid #a05520'}}>
              {unmatchedCount} unmatched
            </div>
          )}
          {ignoredCount > 0 && (
            <button
              onClick={onToggleShowIgnored}
              className="flex items-center gap-1 text-xs px-2 py-0.5 transition-colors"
              style={showIgnored
                ? {color: '#cce8f0', background: '#144960', border: '1px solid #0a3d52', borderTopColor: '#3aa0c0', borderLeftColor: '#3aa0c0'}
                : {color: '#4e9ab4', background: 'transparent', border: '1px solid transparent'}
              }
              title={showIgnored ? "Hide ignored movies" : "Show ignored movies"}
            >
              <EyeOff size={10} />
              {ignoredCount} ignored
            </button>
          )}
        </div>
        {[{label: "Scan Folders", Icon: FolderSearch, onClick: onScan, disabled: loading, primary: true},
          {label: "Auto-Match All", Icon: Zap, onClick: onAutoMatch, disabled: loading || unmatchedCount === 0, primary: false},
          {label: "Probe Files", Icon: ScanSearch, onClick: onProbeAll, disabled: loading || movieCount === 0, primary: false},
        ].map(({label, Icon, onClick, disabled, primary}) => (
          <button
            key={label}
            onClick={onClick}
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={primary ? {
              background: 'linear-gradient(to bottom, #1a7a9a, #0d4d66)',
              color: '#cce8f0',
              border: '1px solid #0a3d52',
              borderTopColor: '#3aa0c0',
              borderLeftColor: '#3aa0c0',
            } : {
              background: 'linear-gradient(to bottom, #144960, #0d3347)',
              color: '#7ab8cc',
              border: '1px solid #0a3d52',
              borderTopColor: '#1d7fa0',
              borderLeftColor: '#1d7fa0',
            }}
          >
            {loading && (label === "Scan Folders" || label === "Auto-Match All" || label === "Probe Files") ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
