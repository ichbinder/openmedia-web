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

  const startStream = useCallback(
    async (fileId: string) => {
      setIsLoadingStream(true);
      try {
        const url = await getStreamUrl(fileId);
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
    },
    [getStreamUrl],
  );

  // Track the best available file (with s3StreamKey) for this movie
  const userId = user?.id;
  const checkKey = userId ? `${userId}|${movie.id}` : null;
  const [availability, setAvailability] = useState<{ key: string; fileId: string | null } | null>(null);
  const isCheckingAvailability = checkKey !== null && availability?.key !== checkKey;
  const streamableFileId = checkKey !== null && availability?.key === checkKey ? availability.fileId : null;

  // Check if this movie has a streamable file in the user's library
  useEffect(() => {
    if (!userId) return;
    const key = `${userId}|${movie.id}`;
    let cancelled = false;

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
        const fileId = streamable[0]?.id ?? null;
        setAvailability({ key, fileId });

        // Auto-play when navigated with #play hash (from library page)
        if (fileId && window.location.hash === "#play") {
          startStream(fileId);
          // Clean hash from URL without triggering navigation
          window.history.replaceState(null, "", window.location.pathname);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[MovieHeroWithPlayer] Availability check failed:", err);
        setAvailability({ key, fileId: null });
      });

    return () => {
      cancelled = true;
    };
  }, [userId, movie.id, checkAvailability, startStream]);

  const handlePlay = useCallback(() => {
    if (!streamableFileId || isLoadingStream) return;
    startStream(streamableFileId);
  }, [streamableFileId, isLoadingStream, startStream]);

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
