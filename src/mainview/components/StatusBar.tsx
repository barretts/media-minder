import { Loader2 } from "lucide-react";

interface StatusBarProps {
  status: string;
  loading: boolean;
}

export function StatusBar({ status, loading }: StatusBarProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1"
      style={{
        background: '#29294a',
        borderTop: '2px solid #404040',
        color: '#e8e8f8',
        fontSize: '11px',
      }}
    >
      {loading && <Loader2 size={11} className="animate-spin" style={{color: '#adb5c6'}} />}
      <span className="truncate">{status}</span>
    </div>
  );
}
