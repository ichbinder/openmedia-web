"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDownloads } from "@/contexts/download-context";
import { VideoPlayer } from "@/components/movie/video-player";
import type { MovieDetail } from "@/lib/tmdb";
import { getBackdropUrl } from "@/lib/tmdb";

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
  const { checkAvailability, getLink } = useDownloads();

  const [isPlaying, setIsPlaying] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(false);

  // Track the best available file (with s3Key) for this movie
  const [streamableFileId, setStreamableFileId] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  // Check if this movie has a streamable file in the user's library
  useEffect(() => {
    if (!user) {
      setStreamableFileId(null);
      return;
    }

    let cancelled = false;
    setIsCheckingAvailability(true);

    checkAvailability(movie.id).then((files) => {
      if (cancelled) return;

      // Find the best file with an s3Key (already downloaded to S3)
      // Prefer highest resolution
      const RES_ORDER = ["2160p", "1080p", "720p", "480p"];
      const streamable = files
        .filter((f) => f.s3Key)
        .sort((a, b) => {
          const ai = a.resolution ? RES_ORDER.indexOf(a.resolution) : 99;
          const bi = b.resolution ? RES_ORDER.indexOf(b.resolution) : 99;
          return (ai === -1 ? 98 : ai) - (bi === -1 ? 98 : bi);
        });

      setStreamableFileId(streamable[0]?.id ?? null);
      setIsCheckingAvailability(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, movie.id, checkAvailability]);

  // Auto-play when navigated with #play hash (from library page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#play" && streamableFileId && !isPlaying) {
      handlePlay();
      // Clean hash from URL without triggering navigation
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamableFileId]);

  const handlePlay = useCallback(async () => {
    if (!streamableFileId || isLoadingStream) return;

    setIsLoadingStream(true);
    try {
      const url = await getLink(streamableFileId);
      if (url) {
        setStreamUrl(url);
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("[MovieHeroWithPlayer] Failed to get stream URL:", err);
    } finally {
      setIsLoadingStream(false);
    }
  }, [streamableFileId, isLoadingStream, getLink]);

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
