"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useDownloads,
  getStatusLabel,
  type ProvisionItem,
} from "@/contexts/download-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getPosterUrl } from "@/lib/tmdb";
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Film,
  Server,
  Search,
} from "lucide-react";

function ProvisionRow({ item }: { item: ProvisionItem }) {
  const { cancelProvision, removeProvision } = useDownloads();
  const posterUrl = item.posterPath
    ? getPosterUrl(item.posterPath, "w92")
    : null;
  const year = item.releaseDate?.split("-")[0] ?? "";

  const isActive = item.status !== "ready" && item.status !== "failed";
  const statusLabel = getStatusLabel(item.status, item.source);

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
        <div className="flex items-center gap-2">
          <Link
            href={`/movie/${item.movieId}`}
            className="truncate text-sm font-medium text-foreground hover:text-cinema-gold"
          >
            {item.title}
          </Link>
          {/* Source badge */}
          {item.source === "usenet" ? (
            <span className="flex shrink-0 items-center gap-1 rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">
              <Server className="size-2.5" />
              Usenet
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-400">
              <Search className="size-2.5" />
              Suche
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{year}</span>

        {/* Progress bar for active provisions */}
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
        {isActive && (
          <span className="flex items-center gap-1 text-xs text-cinema-gold">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="hidden sm:inline">{statusLabel}</span>
            <span className="sm:hidden">{item.progress}%</span>
          </span>
        )}
        {item.status === "ready" && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="size-3.5" />
            Bereit
          </span>
        )}
        {item.status === "failed" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="size-3.5" />
            Fehlgeschlagen
          </span>
        )}

        {isActive && (
          <button
            onClick={() => cancelProvision(item.movieId)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Abbrechen"
          >
            <XCircle className="size-4" />
          </button>
        )}

        {(item.status === "ready" || item.status === "failed") && (
          <button
            onClick={() => removeProvision(item.movieId)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Entfernen"
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
    (d) => d.status !== "ready" && d.status !== "failed"
  );
  const ready = items.filter((d) => d.status === "ready");
  const failed = items.filter((d) => d.status === "failed");

  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Download className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Keine Bereitstellungen</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Gehe zu einer Film-Detailseite und klicke auf &quot;Verfügbar machen&quot; oder
          &quot;Film suchen&quot;, um einen Film bereitzustellen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {active.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            In Bearbeitung ({active.length})
          </h2>
          <div className="space-y-3">
            {active.map((item) => (
              <ProvisionRow key={item.movieId} item={item} />
            ))}
          </div>
        </section>
      )}

      {ready.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Bereitgestellt ({ready.length})
          </h2>
          <div className="space-y-3">
            {ready.map((item) => (
              <ProvisionRow key={item.movieId} item={item} />
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
              <ProvisionRow key={item.movieId} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function DownloadsPage() {
  return (
    <ProtectedRoute message="Melde dich an, um deine Bereitstellungen zu sehen.">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">
          Bereitstellungen
        </h1>
        <DownloadsContent />
      </div>
    </ProtectedRoute>
  );
}
