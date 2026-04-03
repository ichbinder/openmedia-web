"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Server,
  CloudDownload,
} from "lucide-react";
import { useDownloads, getStatusLabel } from "@/contexts/download-context";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NzbFileInfo } from "@/lib/backend";

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

export function DownloadButton({ movie, className }: DownloadButtonProps) {
  const { user } = useAuth();
  const { jobs, startDownload, cancelJob, getLink, checkAvailability } = useDownloads();
  const router = useRouter();

  const [nzbFiles, setNzbFiles] = useState<NzbFileInfo[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Check if NZB files exist for this movie
  useEffect(() => {
    if (!user) return;
    setIsChecking(true);
    checkAvailability(movie.id)
      .then(setNzbFiles)
      .finally(() => setIsChecking(false));
  }, [user, movie.id, checkAvailability]);

  // Find active/completed job for any of this movie's NZB files
  const activeJob = jobs.find(
    (j) =>
      nzbFiles.some((f) => f.id === j.nzbFileId) &&
      j.status !== "completed" &&
      j.status !== "failed"
  );
  // Only treat a job as completed if the S3 file still exists.
  // After library deletion the S3 key is cleared but old jobs may linger.
  const completedJob = jobs.find(
    (j) =>
      nzbFiles.some((f) => f.id === j.nzbFileId && f.s3Key) &&
      j.status === "completed"
  );

  // Also check: is the file already in S3 (downloaded previously)?
  const availableFile = nzbFiles.find((f) => f.s3Key);

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    // If already completed or available in S3 → get download link
    const fileId = completedJob?.nzbFileId || availableFile?.id;
    if (fileId) {
      const url = await getLink(fileId);
      if (url) {
        window.open(url, "_blank");
      }
      return;
    }

    // If active → cancel
    if (activeJob) {
      await cancelJob(activeJob.id);
      return;
    }

    // Start download with the best available NZB file (prefer highest resolution)
    const bestFile = nzbFiles.sort((a, b) => {
      const order = ["2160p", "1080p", "720p", "480p"];
      return (order.indexOf(a.resolution || "") || 99) - (order.indexOf(b.resolution || "") || 99);
    })[0];

    if (!bestFile) return;

    setIsStarting(true);
    await startDownload(bestFile.id);
    setIsStarting(false);
  }

  // Not logged in
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

  // Loading availability
  if (isChecking) {
    return (
      <button disabled className={cn("flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground opacity-50", className)}>
        <Loader2 className="size-4 animate-spin" />
        Verfügbarkeit prüfen…
      </button>
    );
  }

  // No NZB files found for this movie
  if (nzbFiles.length === 0) {
    return (
      <button disabled className={cn("flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground opacity-50", className)}>
        <XCircle className="size-4" />
        Nicht verfügbar
      </button>
    );
  }

  // Already in S3 or completed → download button
  if (availableFile || completedJob) {
    return (
      <button
        onClick={handleDownload}
        className={cn(
          "flex items-center gap-2 rounded-md bg-cinema-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cinema-gold/90",
          className
        )}
      >
        <Download className="size-4" />
        Herunterladen
        {availableFile?.resolution && (
          <span className="rounded bg-black/20 px-1.5 py-0.5 text-xs">{availableFile.resolution}</span>
        )}
      </button>
    );
  }

  // Active download
  if (activeJob) {
    return (
      <button
        onClick={handleDownload}
        className={cn(
          "flex items-center gap-2 rounded-md bg-cinema-gold/20 px-4 py-2 text-sm font-medium text-cinema-gold transition-colors hover:bg-cinema-gold/30",
          className
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <span>{getStatusLabel(activeJob.status)}</span>
          <span className="text-xs opacity-70">{activeJob.progress}%</span>
        </span>
      </button>
    );
  }

  // Ready to start download
  return (
    <button
      onClick={handleDownload}
      disabled={isStarting}
      className={cn(
        "flex items-center gap-2 rounded-md bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/30",
        className
      )}
    >
      {isStarting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CloudDownload className="size-4" />
      )}
      Verfügbar machen
      {nzbFiles[0]?.resolution && (
        <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs">{nzbFiles[0].resolution}</span>
      )}
    </button>
  );
}

// Re-export for backward compatibility
export { DownloadButton as ProvisionButton };
