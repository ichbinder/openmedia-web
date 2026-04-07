"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDownloads, getStatusLabel, isJobStale } from "@/contexts/download-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AssignMovieDialog } from "@/components/downloads/assign-movie-dialog";
import { getPosterUrl } from "@/lib/tmdb";
import type { DownloadJob } from "@/lib/backend";
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Film,
  Tag,
} from "lucide-react";

/**
 * Format the remaining time until a needs_review job expires.
 * Returns strings like "2 Tage 5 Std", "5 Std 12 Min", or "läuft ab" for past timestamps.
 */
function formatRemaining(reviewExpiresAt: string): string {
  const ms = new Date(reviewExpiresAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "läuft ab";

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} Tag${days === 1 ? "" : "e"} ${hours} Std`;
  if (hours > 0) return `${hours} Std ${minutes} Min`;
  return `${minutes} Min`;
}

/**
 * Pull a friendly display name out of an originalFilename like
 * "The.Matrix.1999.1080p.BluRay.x264-GROUP.nzb". Falls back to the hash
 * prefix when no filename is available.
 */
function nzbDisplayName(job: DownloadJob): string {
  const filename = job.nzbFile?.originalFilename;
  if (filename) {
    // Strip extension and trailing groups for a cleaner short label
    return filename.replace(/\.nzb$/i, "");
  }
  return `Hash ${job.nzbFile?.hash?.slice(0, 12) ?? job.nzbFileId.slice(0, 8)}…`;
}

interface JobRowProps {
  job: DownloadJob;
  /** Open the assign-movie dialog for this job. Only relevant for needs_review rows. */
  onAssignClick?: (jobId: string) => void;
}

function JobRow({ job, onAssignClick }: JobRowProps) {
  const { cancelJob, getLink } = useDownloads();
  const movie = job.nzbFile?.movie;
  const posterUrl = movie?.posterPath ? getPosterUrl(movie.posterPath, "w92") : null;

  const isNeedsReview = job.status === "needs_review";
  const isExpired = job.status === "expired";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isActive =
    !isCompleted && !isFailed && !isExpired && !isNeedsReview;
  const stale = isJobStale(job);

  // For needs_review and expired rows we don't have a movie — show the
  // NZB filename as the headline instead of "Unbekannt".
  const headline = movie
    ? movie.titleDe || movie.titleEn
    : nzbDisplayName(job);

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border p-3 ${
        isNeedsReview
          ? "border-amber-500/40 bg-amber-500/5"
          : isExpired
            ? "border-border/30 bg-muted/30"
            : "border-border/40 bg-card"
      }`}
    >
      {/* Poster (or icon placeholder for needs_review/expired) */}
      {movie?.tmdbId ? (
        <Link
          href={`/movie/${movie.tmdbId}`}
          className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted"
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={movie.titleDe || ""}
              fill
              className="object-cover"
              sizes="44px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="size-5 text-muted-foreground" />
            </div>
          )}
        </Link>
      ) : (
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
          <div className="flex h-full w-full items-center justify-center">
            {isNeedsReview ? (
              <AlertCircle className="size-5 text-amber-500" />
            ) : (
              <Film className="size-5 text-muted-foreground" />
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={`truncate font-medium text-sm ${
            isNeedsReview ? "" : isExpired ? "text-muted-foreground" : ""
          }`}
          title={isNeedsReview ? job.nzbFile?.originalFilename : undefined}
        >
          {headline}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {isNeedsReview && <AlertCircle className="size-3 text-amber-500" />}
          {isActive && !stale && <Loader2 className="size-3 animate-spin text-cinema-gold" />}
          {stale && <AlertTriangle className="size-3 text-amber-500" />}
          {isCompleted && <CheckCircle2 className="size-3 text-green-500" />}
          {isFailed && <XCircle className="size-3 text-red-500" />}
          {isExpired && <Clock className="size-3 text-muted-foreground" />}
          <span>
            {stale ? "Möglicherweise hängengeblieben" : getStatusLabel(job.status)}
          </span>
          {isActive && !stale && <span className="text-cinema-gold">{job.progress}%</span>}
          {job.nzbFile?.resolution && (
            <span className="rounded bg-muted px-1.5 py-0.5">{job.nzbFile.resolution}</span>
          )}
          {isNeedsReview && job.reviewExpiresAt && (
            <span className="flex items-center gap-1 text-amber-400">
              <Clock className="size-3" />
              Läuft ab in {formatRemaining(job.reviewExpiresAt)}
            </span>
          )}
        </div>
        {isNeedsReview && job.tmdbRetryCount !== undefined && job.tmdbRetryCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Tag className="size-3" />
            Auto-Suche {job.tmdbRetryCount}/5 versucht
          </p>
        )}
        {stale && (
          <p className="mt-1 text-xs text-amber-400">
            Keine Fortschritte seit über 2 Stunden. Wird automatisch bereinigt.
          </p>
        )}
        {(isFailed || isExpired) && job.error && (
          <p className="mt-1 text-xs text-muted-foreground truncate">{job.error}</p>
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
        {isNeedsReview && onAssignClick && (
          <button
            onClick={() => onAssignClick(job.id)}
            className="rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/25 transition-colors"
            title="TMDB-Film zuordnen"
          >
            Film zuordnen
          </button>
        )}
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
        {(isActive || isNeedsReview) && (
          <button
            onClick={() => cancelJob(job.id)}
            className="rounded p-2 text-red-400 hover:bg-red-500/10"
            title={isNeedsReview ? "Verwerfen" : "Abbrechen"}
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function DownloadsContent() {
  const { jobs, isLoading, refresh } = useDownloads();
  const [openAssignForJobId, setOpenAssignForJobId] = useState<string | null>(null);

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

  // Five sections in display order:
  //   1. Zuordnung erforderlich (needs_review)
  //   2. Aktive Downloads (queued, provisioning, downloading, uploading)
  //   3. Bereit (completed)
  //   4. Fehlgeschlagen (failed)
  //   5. Verworfen (expired)
  const needsReview = jobs.filter((j) => j.status === "needs_review");
  const active = jobs.filter((j) =>
    ["queued", "provisioning", "downloading", "uploading"].includes(j.status),
  );
  const completed = jobs.filter((j) => j.status === "completed");
  const failed = jobs.filter((j) => j.status === "failed");
  const expired = jobs.filter((j) => j.status === "expired");

  const targetJob = openAssignForJobId
    ? jobs.find((j) => j.id === openAssignForJobId)
    : undefined;

  return (
    <div className="space-y-6">
      {needsReview.length > 0 && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="mb-1 text-lg font-semibold text-amber-400 flex items-center gap-2">
            <AlertCircle className="size-5" />
            Zuordnung erforderlich ({needsReview.length})
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Diese NZBs konnten keinem Film auf TMDB zugeordnet werden. Wähle den
            passenden Film aus, damit der Download starten kann.
          </p>
          <div className="space-y-2">
            {needsReview.map((job) => (
              <JobRow key={job.id} job={job} onAssignClick={setOpenAssignForJobId} />
            ))}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Aktive Downloads ({active.length})</h2>
          <div className="space-y-2">
            {active.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-green-400">
            Bereit ({completed.length})
          </h2>
          <div className="space-y-2">
            {completed.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {failed.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-red-400">
            Fehlgeschlagen ({failed.length})
          </h2>
          <div className="space-y-2">
            {failed.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {expired.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Verworfen ({expired.length})
          </h2>
          <div className="space-y-2">
            {expired.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* Single dialog instance, controlled by openAssignForJobId */}
      {targetJob && (
        <AssignMovieDialog
          open={openAssignForJobId !== null}
          onOpenChange={(open) => {
            if (!open) setOpenAssignForJobId(null);
          }}
          jobId={targetJob.id}
          hint={{
            filename: targetJob.nzbFile?.originalFilename,
          }}
          onAssigned={() => {
            void refresh();
          }}
        />
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
