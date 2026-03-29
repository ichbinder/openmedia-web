"use client";

import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Server,
  Play,
  CloudDownload,
} from "lucide-react";
import { useDownloads, getStatusLabel } from "@/contexts/download-context";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProvisionButtonProps {
  movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date: string;
  };
  className?: string;
}

export function ProvisionButton({ movie, className }: ProvisionButtonProps) {
  const { user } = useAuth();
  const {
    provisionMovie,
    cancelProvision,
    getProvision,
    isUsenetAvailable,
  } = useDownloads();
  const router = useRouter();

  const provision = getProvision(movie.id);
  const usenetAvailable = isUsenetAvailable(movie.id);

  const isActive =
    provision &&
    provision.status !== "ready" &&
    provision.status !== "failed";
  const isReady = provision?.status === "ready";

  function handleProvision(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    if (isActive) {
      cancelProvision(movie.id);
      return;
    }

    provisionMovie({
      movieId: movie.id,
      title: movie.title,
      posterPath: movie.poster_path,
      voteAverage: movie.vote_average,
      releaseDate: movie.release_date,
      source: usenetAvailable ? "usenet" : "search",
    });
  }

  // Film is ready — show Stream + Download buttons
  if (isReady) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <button
          className="flex items-center gap-2 rounded-md bg-cinema-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cinema-gold/90"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Mock: navigate to detail page (real streaming later)
            router.push(`/movie/${movie.id}`);
          }}
        >
          <Play className="size-4 fill-black" />
          Streamen
        </button>
        <button
          className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Mock: no actual download
          }}
        >
          <Download className="size-4" />
          Herunterladen
        </button>
      </div>
    );
  }

  // Provisioning in progress
  if (isActive) {
    const statusLabel = getStatusLabel(provision!.status, provision!.source);
    return (
      <button
        onClick={handleProvision}
        className={cn(
          "flex items-center gap-2 rounded-md bg-cinema-gold/20 px-4 py-2 text-sm font-medium text-cinema-gold transition-colors hover:bg-cinema-gold/30",
          className
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <span>{statusLabel}</span>
          <span className="text-xs opacity-70">{provision!.progress}% — Klick zum Abbrechen</span>
        </span>
      </button>
    );
  }

  // Not started — show provision button based on availability
  if (usenetAvailable) {
    return (
      <button
        onClick={handleProvision}
        className={cn(
          "flex items-center gap-2 rounded-md bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/30",
          className
        )}
      >
        <Server className="size-4" />
        Verfügbar machen
        <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs">Usenet</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleProvision}
      className={cn(
        "flex items-center gap-2 rounded-md bg-orange-500/20 px-4 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/30",
        className
      )}
    >
      <Search className="size-4" />
      Film suchen & bereitstellen
    </button>
  );
}
