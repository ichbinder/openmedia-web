"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Loader2,
  XCircle,
  CloudDownload,
  AlertTriangle,
  ChevronDown,
  Check,
} from "lucide-react";
import { useDownloads, getStatusLabel } from "@/contexts/download-context";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NzbFileInfo, DownloadJob } from "@/lib/backend";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface DownloadButtonProps {
  movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date: string;
  };
  className?: string;
}

/** Resolution sort order — higher resolution first */
const RES_ORDER = ["2160p", "1080p", "720p", "480p"];
function resIndex(r: string | null): number {
  if (!r) return 99;
  const idx = RES_ORDER.indexOf(r);
  return idx === -1 ? 98 : idx;
}

export function DownloadButton({ movie, className }: DownloadButtonProps) {
  const { user } = useAuth();
  const { jobs, startDownload, cancelJob, getLink, checkAvailability } =
    useDownloads();
  const router = useRouter();

  const [nzbFiles, setNzbFiles] = useState<NzbFileInfo[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  // Fetch NZB files for this movie
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setIsChecking(true);
    checkAvailability(movie.id)
      .then((files) => {
        if (!cancelled) setNzbFiles(files);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, movie.id, checkAvailability]);

  // Re-fetch when any job completes so s3Key is up to date
  const completedJobIds = jobs
    .filter(
      (j) =>
        nzbFiles.some((f) => f.id === j.nzbFileId) && j.status === "completed"
    )
    .map((j) => j.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!completedJobIds || !user) return;
    let cancelled = false;
    checkAvailability(movie.id).then((files) => {
      if (!cancelled) setNzbFiles(files);
    });
    return () => {
      cancelled = true;
    };
  }, [completedJobIds, user, movie.id, checkAvailability]);

  // ── Derived state ─────────────────────────────────────────

  // Filter out NZBs with 3+ failures (completely hidden)
  // Defensive fallback: if failedAttempts is missing (old API), treat as 0
  const visibleFiles = nzbFiles.filter((f) => (f.failedAttempts ?? 0) < 3);

  // Categorize
  const downloadedFiles = visibleFiles.filter((f) => f.s3Key);
  const brokenFiles = visibleFiles.filter(
    (f) => f.status === "broken" && !f.s3Key
  );
  const availableFiles = visibleFiles.filter(
    (f) => f.status !== "broken" && !f.s3Key
  );

  // Sort each group by resolution
  const sortByRes = (a: NzbFileInfo, b: NzbFileInfo) =>
    resIndex(a.resolution) - resIndex(b.resolution);
  downloadedFiles.sort(sortByRes);
  availableFiles.sort(sortByRes);
  brokenFiles.sort(sortByRes);

  // Get active job for a specific NZB file
  function getActiveJob(nzbFileId: string): DownloadJob | undefined {
    return jobs.find(
      (j) =>
        j.nzbFileId === nzbFileId &&
        j.status !== "completed" &&
        j.status !== "failed"
    );
  }

  // ── Handlers ──────────────────────────────────────────────

  async function handleDownloadClick(fileId: string) {
    if (!user) {
      router.push("/login");
      return;
    }
    const url = await getLink(fileId);
    if (url) window.open(url, "_blank");
  }

  async function handleStartDownload(fileId: string) {
    if (!user) {
      router.push("/login");
      return;
    }
    setStartingId(fileId);
    try {
      await startDownload(fileId);
    } finally {
      setStartingId(null);
    }
  }

  async function handleCancelDownload(jobId: string) {
    await cancelJob(jobId);
  }

  // ── Render: not logged in ─────────────────────────────────

  if (!user) {
    return (
      <button
        onClick={() => router.push("/login")}
        className={cn(
          "flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80",
          className
        )}
      >
        <Download className="size-4" />
        Anmelden zum Herunterladen
      </button>
    );
  }

  // ── Render: loading ───────────────────────────────────────

  if (isChecking) {
    return (
      <button
        disabled
        className={cn(
          "flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground opacity-50",
          className
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        Verfügbarkeit prüfen…
      </button>
    );
  }

  // ── Render: nothing available ─────────────────────────────

  if (visibleFiles.length === 0) {
    return (
      <button
        disabled
        className={cn(
          "flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground opacity-50",
          className
        )}
      >
        <XCircle className="size-4" />
        Nicht verfügbar
      </button>
    );
  }

  // ── Render: single usable file → direct button ────────────

  const usableFiles = [...downloadedFiles, ...availableFiles];
  const hasActiveDownload = visibleFiles.some((f) => getActiveJob(f.id));

  if (usableFiles.length === 1 && brokenFiles.length === 0 && !hasActiveDownload) {
    const file = usableFiles[0];
    if (file.s3Key) {
      // Downloaded → gold button
      return (
        <button
          onClick={() => handleDownloadClick(file.id)}
          className={cn(
            "flex items-center gap-2 rounded-md bg-cinema-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cinema-gold/90",
            className
          )}
        >
          <Download className="size-4" />
          Herunterladen
          {file.resolution && (
            <span className="rounded bg-black/20 px-1.5 py-0.5 text-xs">
              {file.resolution}
            </span>
          )}
        </button>
      );
    }
    // Available → green button
    return (
      <button
        onClick={() => handleStartDownload(file.id)}
        disabled={startingId === file.id}
        className={cn(
          "flex items-center gap-2 rounded-md bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/30",
          className
        )}
      >
        {startingId === file.id ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CloudDownload className="size-4" />
        )}
        Verfügbar machen
        {file.resolution && (
          <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs">
            {file.resolution}
          </span>
        )}
      </button>
    );
  }

  // ── Render: dropdown with all NZBs ────────────────────────

  // Determine the trigger button style based on best available state
  const hasSomeDownloaded = downloadedFiles.length > 0;
  const hasSomeActive = hasActiveDownload;

  // Find the best active job for the trigger display
  const bestActiveJob = visibleFiles
    .map((f) => getActiveJob(f.id))
    .find(Boolean);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
          hasSomeDownloaded
            ? "bg-cinema-gold text-black hover:bg-cinema-gold/90"
            : hasSomeActive
              ? "bg-cinema-gold/20 text-cinema-gold hover:bg-cinema-gold/30"
              : "bg-green-500/20 text-green-400 hover:bg-green-500/30",
          className
        )}
      >
        {hasSomeActive ? (
          <Loader2 className="size-4 animate-spin" />
        ) : hasSomeDownloaded ? (
          <Download className="size-4" />
        ) : (
          <CloudDownload className="size-4" />
        )}
        {hasSomeDownloaded
          ? "Herunterladen"
          : hasSomeActive
            ? getStatusLabel(bestActiveJob!.status)
            : "Verfügbar machen"}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        {/* Downloaded files */}
        {downloadedFiles.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Bereit zum Herunterladen
            </div>
            {downloadedFiles.map((file) => (
              <NzbDropdownItem
                key={file.id}
                file={file}
                variant="downloaded"
                activeJob={getActiveJob(file.id)}
                startingId={startingId}
                onDownload={handleDownloadClick}
                onStart={handleStartDownload}
                onCancel={handleCancelDownload}
              />
            ))}
          </>
        )}

        {/* Available files */}
        {availableFiles.length > 0 && (
          <>
            {downloadedFiles.length > 0 && <DropdownMenuSeparator />}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Verfügbar
            </div>
            {availableFiles.map((file) => (
              <NzbDropdownItem
                key={file.id}
                file={file}
                variant="available"
                activeJob={getActiveJob(file.id)}
                startingId={startingId}
                onDownload={handleDownloadClick}
                onStart={handleStartDownload}
                onCancel={handleCancelDownload}
              />
            ))}
          </>
        )}

        {/* Broken files */}
        {brokenFiles.length > 0 && (
          <>
            {(downloadedFiles.length > 0 || availableFiles.length > 0) && (
              <DropdownMenuSeparator />
            )}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Fehlerhaft
            </div>
            {brokenFiles.map((file) => (
              <NzbDropdownItem
                key={file.id}
                file={file}
                variant="broken"
                activeJob={undefined}
                startingId={startingId}
                onDownload={handleDownloadClick}
                onStart={handleStartDownload}
                onCancel={handleCancelDownload}
              />
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── NZB Dropdown Item ──────────────────────────────────────────

interface NzbDropdownItemProps {
  file: NzbFileInfo;
  variant: "downloaded" | "available" | "broken";
  activeJob: DownloadJob | undefined;
  startingId: string | null;
  onDownload: (fileId: string) => void;
  onStart: (fileId: string) => void;
  onCancel: (jobId: string) => void;
}

function NzbDropdownItem({
  file,
  variant,
  activeJob,
  startingId,
  onDownload,
  onStart,
  onCancel,
}: NzbDropdownItemProps) {
  const isBroken = variant === "broken";
  const isDownloading = !!activeJob;
  const isStarting = startingId === file.id;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isBroken) return;

    if (isDownloading && activeJob) {
      onCancel(activeJob.id);
      return;
    }

    if (variant === "downloaded") {
      onDownload(file.id);
    } else {
      onStart(file.id);
    }
  }

  return (
    <DropdownMenuItem
      onClick={handleClick}
      disabled={isBroken}
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2.5",
        isBroken && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Status icon */}
        {isBroken ? (
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
        ) : isDownloading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-cinema-gold" />
        ) : variant === "downloaded" ? (
          <Check className="size-3.5 shrink-0 text-cinema-gold" />
        ) : (
          <CloudDownload className="size-3.5 shrink-0 text-green-400" />
        )}

        {/* File info */}
        <div className="flex flex-col min-w-0">
          <span
            className={cn(
              "text-sm font-medium",
              isBroken && "line-through text-muted-foreground"
            )}
          >
            {file.resolution || "Unbekannt"}
            {file.hash && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                {file.hash.slice(0, 8)}
              </span>
            )}
          </span>

          {/* Subtitle: status info */}
          {isDownloading && activeJob && (
            <span className="text-xs text-cinema-gold">
              {getStatusLabel(activeJob.status)} · {activeJob.progress}%
            </span>
          )}
          {isBroken && file.brokenReason && (
            <span className="text-xs text-destructive truncate max-w-[200px]">
              {file.brokenReason}
            </span>
          )}
          {variant === "downloaded" && !isDownloading && (
            <span className="text-xs text-muted-foreground">Bereit</span>
          )}
        </div>
      </div>

      {/* Action badge */}
      {!isBroken && (
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
            isDownloading
              ? "bg-cinema-gold/20 text-cinema-gold"
              : variant === "downloaded"
                ? "bg-cinema-gold/20 text-cinema-gold"
                : isStarting
                  ? "bg-green-500/20 text-green-400"
                  : "bg-green-500/10 text-green-400"
          )}
        >
          {isStarting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : isDownloading ? (
            "Abbrechen"
          ) : variant === "downloaded" ? (
            "Download"
          ) : (
            "Starten"
          )}
        </span>
      )}
    </DropdownMenuItem>
  );
}

// Re-export for backward compatibility
export { DownloadButton as ProvisionButton };
