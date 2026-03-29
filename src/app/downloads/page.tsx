"use client";

import Image from "next/image";
import Link from "next/link";
import { useDownloads, type DownloadItem } from "@/contexts/download-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getPosterUrl } from "@/lib/tmdb";
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Film,
} from "lucide-react";
import { cn } from "@/lib/utils";

function DownloadRow({ item }: { item: DownloadItem }) {
  const { cancelDownload, removeDownload } = useDownloads();
  const posterUrl = item.posterPath
    ? getPosterUrl(item.posterPath, "w92")
    : null;
  const year = item.releaseDate?.split("-")[0] ?? "";

  const isActive = item.status === "downloading" || item.status === "queued";

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-card p-3">
      {/* Poster thumbnail */}
      <Link
        href={`/movie/${item.movieId}`}
        className="relative size-16 flex-shrink-0 overflow-hidden rounded bg-muted"
      >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Film className="size-5 text-muted-foreground" />
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/movie/${item.movieId}`}
          className="truncate text-sm font-medium text-foreground hover:text-cinema-gold"
        >
          {item.title}
        </Link>
        <span className="text-xs text-muted-foreground">{year}</span>

        {/* Progress bar for active downloads */}
        {isActive && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-cinema-gold transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-2">
        {item.status === "queued" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Download className="size-3.5" />
            Wartend
          </span>
        )}
        {item.status === "downloading" && (
          <span className="flex items-center gap-1 text-xs text-cinema-gold">
            <Loader2 className="size-3.5 animate-spin" />
            {item.progress}%
          </span>
        )}
        {item.status === "completed" && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="size-3.5" />
            Fertig
          </span>
        )}
        {item.status === "failed" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="size-3.5" />
            Abgebrochen
          </span>
        )}

        {isActive && (
          <button
            onClick={() => cancelDownload(item.movieId)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Download abbrechen"
          >
            <XCircle className="size-4" />
          </button>
        )}

        {(item.status === "completed" || item.status === "failed") && (
          <button
            onClick={() => removeDownload(item.movieId)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Download entfernen"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function DownloadsContent() {
  const { items } = useDownloads();

  const active = items.filter(
    (d) => d.status === "downloading" || d.status === "queued"
  );
  const completed = items.filter((d) => d.status === "completed");
  const failed = items.filter((d) => d.status === "failed");

  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Download className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Keine Downloads</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Gehe zu einer Film-Detailseite und klicke auf &quot;Herunterladen&quot;, um
          einen Download zu starten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {active.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Aktive Downloads ({active.length})
          </h2>
          <div className="space-y-3">
            {active.map((item) => (
              <DownloadRow key={item.movieId} item={item} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Abgeschlossen ({completed.length})
          </h2>
          <div className="space-y-3">
            {completed.map((item) => (
              <DownloadRow key={item.movieId} item={item} />
            ))}
          </div>
        </section>
      )}

      {failed.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Fehlgeschlagen ({failed.length})
          </h2>
          <div className="space-y-3">
            {failed.map((item) => (
              <DownloadRow key={item.movieId} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function DownloadsPage() {
  return (
    <ProtectedRoute message="Melde dich an, um deine Downloads zu sehen.">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
          Downloads
        </h1>
        <DownloadsContent />
      </div>
    </ProtectedRoute>
  );
}
