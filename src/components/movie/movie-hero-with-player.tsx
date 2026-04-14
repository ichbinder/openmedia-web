"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { useDownloads } from "@/contexts/download-context";
import { VideoPlayer } from "@/components/movie/video-player";
import type { MovieDetail } from "@/lib/tmdb";
import { getBackdropUrl } from "@/lib/tmdb";
import { qualityRank } from "@/lib/utils";

interface MovieHeroWithPlayerProps {
  movie: MovieDetail;
  /** Server-rendered hero backdrop (shown by default, replaced by player on play) */
  children: React.ReactNode;
}

export function MovieHeroWithPlayer({
  movie,
  children,
}: MovieHeroWithPlayerProps) {
  const { user } = useAuth();
  const { checkAvailability, getStreamUrl } = useDownloads();

  const [isPlaying, setIsPlaying] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(false);

  // Track the best available file (with s3StreamKey) for this movie
  const [streamableFileId, setStreamableFileId] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  // Check if this movie has a streamable file in the user's library
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setStreamableFileId(null);
      return;
    }

    let cancelled = false;
    setIsCheckingAvailability(true);

    checkAvailability(movie.id)
      .then((files) => {
        if (cancelled) return;

        // Find the best file with a stream version (s3StreamKey = browser-compatible MP4)
        // Prefer highest resolution
        const streamable = files
          .filter((f) => f.s3StreamKey)
          .sort((a, b) => {
            return qualityRank(a.qualityTier || a.resolution) - qualityRank(b.qualityTier || b.resolution);
          });

        setStreamableFileId(streamable[0]?.id ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[MovieHeroWithPlayer] Availability check failed:", err);
        setStreamableFileId(null);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, movie.id, checkAvailability]);

  // Auto-play when navigated with #play hash (from library page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#play" && streamableFileId && !isPlaying) {
      handlePlay();
      // Clean hash from URL without triggering navigation
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally omit handlePlay/isPlaying to trigger auto-play only once when streamableFileId becomes available
  }, [streamableFileId]);

  const handlePlay = useCallback(async () => {
    if (!streamableFileId || isLoadingStream) return;

    setIsLoadingStream(true);
    try {
      const url = await getStreamUrl(streamableFileId);
      if (url) {
        setStreamUrl(url);
        setIsPlaying(true);
      } else {
        toast.error("Stream konnte nicht gestartet werden", {
          description: "Der Download-Link konnte nicht abgerufen werden.",
        });
      }
    } catch (err) {
      console.error("[MovieHeroWithPlayer] Failed to get stream URL:", err);
      toast.error("Stream fehlgeschlagen", {
        description: "Bitte versuche es später erneut.",
      });
    } finally {
      setIsLoadingStream(false);
    }
  }, [streamableFileId, isLoadingStream, getStreamUrl]);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    setStreamUrl(null);
  }, []);

  const backdropUrl = getBackdropUrl(movie.backdrop_path, "w1280");

  // Player is active — render Vidstack instead of backdrop
  if (isPlaying && streamUrl) {
    return (
      <section className="relative w-full">
        <div className="relative w-full md:mx-auto md:max-w-6xl md:px-6 lg:px-8">
          <VideoPlayer
            src={streamUrl}
            title={movie.title}
            posterUrl={backdropUrl ?? undefined}
            onClose={handleClose}
            autoPlay
          />
        </div>
        {/* Spacer to maintain layout — the hero overlay content sits below */}
      </section>
    );
  }

  // Default: show the hero backdrop with optional play overlay
  return (
    <section className="relative w-full">
      {children}

      {/* Play button overlay — only when a streamable file is available */}
      {streamableFileId && !isCheckingAvailability && (
        <button
          onClick={handlePlay}
          disabled={isLoadingStream}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30 focus-visible:bg-black/30"
          aria-label={`${movie.title} abspielen`}
        >
          <div className="flex items-center justify-center rounded-full bg-cinema-gold/90 p-4 shadow-xl transition-transform hover:scale-110 md:p-5">
            {isLoadingStream ? (
              <Loader2 className="size-8 animate-spin text-black md:size-10" />
            ) : (
              <Play className="size-8 fill-black text-black md:size-10" />
            )}
          </div>
        </button>
      )}
    </section>
  );
}
