import { Loader2 } from "lucide-react";

interface StatusBarProps {
  status: string;
  loading: boolean;
}

export function StatusBar({ status, loading }: StatusBarProps) {
  return (
    <div className="flex items-center gap-2 border-t border-surface-700 bg-surface-900 px-4 py-1.5">
      {loading && <Loader2 size={12} className="animate-spin text-blue-400" />}
      <span className="text-xs text-surface-400 truncate">{status}</span>
    </div>
  );
}
