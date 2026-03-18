import { useState, useEffect } from "react";
import { X, Loader2, Download, Check, Image } from "lucide-react";
import { api } from "../api";
import type { ScannedMovie } from "../types";

interface ImageEntry {
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  lang: string;
  rating: number;
}

interface ImagePickerModalProps {
  movie: ScannedMovie;
  initialTab?: "poster" | "fanart";
  onClose: () => void;
  onSaved: (updatedMovie: ScannedMovie) => void;
}

export function ImagePickerModal({ movie, initialTab = "poster", onClose, onSaved }: ImagePickerModalProps) {
  const [tab, setTab] = useState<"poster" | "fanart">(initialTab);
  const [posters, setPosters] = useState<ImageEntry[]>([]);
  const [fanarts, setFanarts] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.getMovieImages(movie.id)
      .then((data) => {
        setPosters(data.posters || []);
        setFanarts(data.fanarts || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [movie.id]);

  const handleSave = async (entry: ImageEntry, type: "poster" | "fanart") => {
    setSaving(entry.url);
    try {
      const result = await api.saveImage(movie.id, entry.url, type);
      onSaved(result.movie);
      setSaved(entry.url);
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(null);
  };

  const images = tab === "poster" ? posters : fanarts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] bg-surface-900 rounded-xl shadow-2xl border border-surface-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-surface-100">Select Images</h2>
            <p className="text-xs text-surface-400 mt-0.5">{movie.movieData?.title || movie.parsedTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pt-3 pb-2 border-b border-surface-800 shrink-0">
          {(["poster", "fanart"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? "bg-blue-600 text-white" : "bg-surface-800 text-surface-400 hover:text-surface-200"
              }`}
            >
              {t === "poster" ? `Posters (${posters.length})` : `Fanart (${fanarts.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-blue-400" />
              <span className="ml-3 text-sm text-surface-400">Loading images…</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400 text-sm">{error}</div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-500">
              <Image size={36} className="mb-3 opacity-40" />
              <p className="text-sm">No {tab} images available</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${tab === "poster" ? "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3"}`}>
              {images.map((entry) => {
                const isSaving = saving === entry.url;
                const isSaved = saved === entry.url;
                return (
                  <div key={entry.url} className="relative group rounded-lg overflow-hidden bg-surface-800 border border-surface-700 hover:border-blue-500 transition-colors">
                    <img
                      src={entry.previewUrl}
                      alt=""
                      className={`w-full object-cover ${tab === "poster" ? "aspect-[2/3]" : "aspect-video"}`}
                      loading="lazy"
                    />
                    {/* Dimensions badge */}
                    {entry.width > 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-black/70 rounded px-1.5 py-0.5 text-xs text-surface-200 font-mono">
                        {entry.width}×{entry.height}
                      </div>
                    )}
                    {/* Rating badge */}
                    {entry.rating > 0 && (
                      <div className="absolute top-1.5 right-1.5 bg-black/70 rounded px-1.5 py-0.5 text-xs text-amber-400 font-mono">
                        ★{entry.rating.toFixed(1)}
                      </div>
                    )}
                    {/* Download overlay */}
                    <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
                      <button
                        onClick={() => handleSave(entry, tab)}
                        disabled={!!saving}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          isSaved
                            ? "bg-green-600 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                        }`}
                      >
                        {isSaving ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isSaved ? (
                          <Check size={12} />
                        ) : (
                          <Download size={12} />
                        )}
                        {isSaved ? "Saved!" : "Use this"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
