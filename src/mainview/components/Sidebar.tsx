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
  const motifBtn: React.CSSProperties = {
    background: '#bebebe',
    borderTop: '2px solid #ffffff',
    borderLeft: '2px solid #ffffff',
    borderBottom: '2px solid #404040',
    borderRight: '2px solid #404040',
    color: '#000000',
    cursor: 'pointer',
  };

  return (
    <div className="flex w-56 flex-col" style={{background: '#bebebe', borderRight: '2px solid #404040', boxShadow: '2px 0 4px rgba(0,0,0,0.3)'}}>
      {/* Title bar - Solaris purple */}
      <div className="px-3 py-1.5 flex items-center gap-2" style={{background: 'linear-gradient(to right, #847bbd, #524a8c)', color: '#ffffff', fontSize: '11px', fontWeight: 'bold', userSelect: 'none'}}>
        <Film size={12} />
        <span>MediaMinder</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-1.5 space-y-0.5" style={{background: '#bebebe'}}>
        {(["movies", "duplicates", "settings"] as const).map((v) => {
          const Icon = v === "movies" ? Film : v === "duplicates" ? Copy : Settings;
          const label = v === "movies" ? "Movies" : v === "duplicates" ? "Duplicates" : "Settings";
          const badge = v === "movies" ? movieCount : v === "duplicates" ? duplicateCount : 0;
          const isActive = view === v;
          return (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className="flex w-full items-center gap-2 px-2 py-1 text-xs"
              style={isActive ? {
                background: '#000080',
                color: '#ffffff',
                border: '1px solid #404040',
                outline: 'none',
              } : {
                background: 'transparent',
                color: '#000000',
                border: '1px solid transparent',
              }}
            >
              <Icon size={13} />
              <span>{label}</span>
              {badge > 0 && (
                <span className="ml-auto text-xs px-1" style={{background: isActive ? '#000060' : '#adb5c6', color: isActive ? '#ffffff' : '#000000', border: '1px inset #808080'}}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <div style={{height: '1px', background: '#808080', margin: '4px 2px'}} />
        {ignoredCount > 0 && (
          <button
            onClick={onToggleShowIgnored}
            className="flex w-full items-center gap-2 px-2 py-1 text-xs"
            style={showIgnored
              ? {background: '#000080', color: '#ffffff', border: '1px solid #404040'}
              : {background: 'transparent', color: '#333333', border: '1px solid transparent'}
            }
          >
            <EyeOff size={12} />
            <span>{ignoredCount} ignored</span>
          </button>
        )}
      </nav>

      {/* Status info */}
      {unmatchedCount > 0 && (
        <div className="mx-2 px-2 py-0.5 text-xs" style={{background: '#ffff88', border: '1px solid #808000', color: '#444400', marginBottom: '4px'}}>
          {unmatchedCount} unmatched
        </div>
      )}

      {/* Action buttons */}
      <div className="p-2 space-y-1" style={{borderTop: '2px solid #808080', background: '#bebebe'}}>
        {[
          {label: "Scan Folders", Icon: FolderSearch, onClick: onScan, disabled: loading},
          {label: "Auto-Match All", Icon: Zap, onClick: onAutoMatch, disabled: loading || unmatchedCount === 0},
          {label: "Probe Files", Icon: ScanSearch, onClick: onProbeAll, disabled: loading || movieCount === 0},
        ].map(({label, Icon, onClick, disabled}) => (
          <button
            key={label}
            onClick={onClick}
            disabled={disabled}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-xs disabled:opacity-50"
            style={motifBtn}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
