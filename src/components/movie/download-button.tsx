"use client";

import { Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useDownloads } from "@/contexts/download-context";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
  const { startDownload, cancelDownload, getDownload } = useDownloads();
  const router = useRouter();

  const download = getDownload(movie.id);
  const isActive =
    download?.status === "downloading" || download?.status === "queued";
  const isCompleted = download?.status === "completed";

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    if (isActive) {
      cancelDownload(movie.id);
      return;
    }

    startDownload({
      movieId: movie.id,
      title: movie.title,
      posterPath: movie.poster_path,
      voteAverage: movie.vote_average,
      releaseDate: movie.release_date,
    });
  }

  if (isCompleted) {
    return (
      <span
        className={cn(
          "flex items-center gap-2 rounded-md bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400",
          className
        )}
      >
        <CheckCircle2 className="size-4" />
        Heruntergeladen
      </span>
    );
  }

  if (isActive) {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-2 rounded-md bg-cinema-gold/20 px-4 py-2 text-sm font-medium text-cinema-gold transition-colors hover:bg-cinema-gold/30",
          className
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        {download!.progress}% — Abbrechen
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground",
        className
      )}
    >
      <Download className="size-4" />
      Herunterladen
    </button>
  );
}
