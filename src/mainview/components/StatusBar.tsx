import { Loader2 } from "lucide-react";

interface StatusBarProps {
  status: string;
  loading: boolean;
}

export function StatusBar({ status, loading }: StatusBarProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5"
      style={{
        borderTop: '2px solid #0a3d52',
        boxShadow: 'inset 0 2px 0 #3aa0c0',
        background: 'linear-gradient(to bottom, #0d3347, #071e2e)',
      }}
    >
      {loading && <Loader2 size={12} className="animate-spin" style={{color: '#48cae4'}} />}
      <span className="text-xs truncate" style={{color: '#4e9ab4'}}>{status}</span>
    </div>
  );
}
