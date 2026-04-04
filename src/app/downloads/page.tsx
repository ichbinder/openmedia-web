"use client";

import Image from "next/image";
import Link from "next/link";
import { useDownloads, getStatusLabel, isJobStale } from "@/contexts/download-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getPosterUrl } from "@/lib/tmdb";
import type { DownloadJob } from "@/lib/backend";
import {
  AlertTriangle,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Film,
} from "lucide-react";

function JobRow({ job }: { job: DownloadJob }) {
  const { cancelJob, getLink } = useDownloads();
  const movie = job.nzbFile?.movie;
  const posterUrl = movie?.posterPath
    ? getPosterUrl(movie.posterPath, "w92")
    : null;

  const isActive = job.status !== "completed" && job.status !== "failed";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const stale = isJobStale(job);

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-card p-3">
      {/* Poster */}
      {movie?.tmdbId ? (
        <Link
          href={`/movie/${movie.tmdbId}`}
          className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted"
        >
          {posterUrl ? (
            <Image src={posterUrl} alt={movie?.titleDe || ""} fill className="object-cover" sizes="44px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="size-5 text-muted-foreground" />
            </div>
          )}
        </Link>
      ) : (
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
          <div className="flex h-full w-full items-center justify-center">
            <Film className="size-5 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-sm">{movie?.titleDe || movie?.titleEn || "Unbekannt"}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isActive && !stale && <Loader2 className="size-3 animate-spin text-cinema-gold" />}
          {stale && <AlertTriangle className="size-3 text-amber-500" />}
          {isCompleted && <CheckCircle2 className="size-3 text-green-500" />}
          {isFailed && <XCircle className="size-3 text-red-500" />}
          <span>{stale ? "Möglicherweise hängengeblieben" : getStatusLabel(job.status)}</span>
          {isActive && !stale && <span className="text-cinema-gold">{job.progress}%</span>}
          {job.nzbFile?.resolution && (
            <span className="rounded bg-muted px-1.5 py-0.5">{job.nzbFile.resolution}</span>
          )}
        </div>
        {stale && (
          <p className="mt-1 text-xs text-amber-400">
            Keine Fortschritte seit über 2 Stunden. Wird automatisch bereinigt.
          </p>
        )}
        {isFailed && job.error && (
          <p className="mt-1 text-xs text-red-400 truncate">{job.error}</p>
        )}
      </div>

      {/* Progress bar */}
      {isActive && !stale && (
        <div className="w-24 shrink-0">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-cinema-gold transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        {isCompleted && (
          <button
            onClick={async () => {
              const url = await getLink(job.nzbFileId);
              if (url) window.open(url, "_blank");
            }}
            className="rounded p-2 text-green-400 hover:bg-green-500/10"
            title="Herunterladen"
          >
            <Download className="size-4" />
          </button>
        )}
        {isActive && (
          <button
            onClick={() => cancelJob(job.id)}
            className="rounded p-2 text-red-400 hover:bg-red-500/10"
            title="Abbrechen"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function DownloadsContent() {
  const { jobs, isLoading } = useDownloads();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-cinema-gold" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center text-muted-foreground">
        <Download className="size-12 opacity-40" />
        <div>
          <p className="text-lg font-medium">Keine Downloads</p>
          <p className="text-sm">Starte einen Download über die Film-Detailseite.</p>
        </div>
      </div>
    );
  }

  const active = jobs.filter((j) => j.status !== "completed" && j.status !== "failed");
  const completed = jobs.filter((j) => j.status === "completed");
  const failed = jobs.filter((j) => j.status === "failed");

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Aktive Downloads ({active.length})</h2>
          <div className="space-y-2">
            {active.map((job) => <JobRow key={job.id} job={job} />)}
          </div>
        </section>
      )}
      {completed.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-green-400">Bereit ({completed.length})</h2>
          <div className="space-y-2">
            {completed.map((job) => <JobRow key={job.id} job={job} />)}
          </div>
        </section>
      )}
      {failed.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-red-400">Fehlgeschlagen ({failed.length})</h2>
          <div className="space-y-2">
            {failed.map((job) => <JobRow key={job.id} job={job} />)}
          </div>
        </section>
      )}
    </div>
  );
}

export default function DownloadsPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Downloads</h1>
        <DownloadsContent />
      </div>
    </ProtectedRoute>
  );
}
