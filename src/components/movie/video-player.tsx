"use client";

import { useRef, useCallback, useEffect } from "react";
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  type MediaPlayerInstance,
  type MediaRemotePlaybackChangeEventDetail,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { X } from "lucide-react";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

interface VideoPlayerProps {
  /** Presigned S3 URL for the video */
  src: string;
  /** Movie title shown in the player */
  title: string;
  /** Poster/backdrop image URL */
  posterUrl?: string;
  /** Called when the player should be closed */
  onClose: () => void;
  /** Auto-play on mount */
  autoPlay?: boolean;
}

export function VideoPlayer({
  src,
  title,
  posterUrl,
  onClose,
  autoPlay = false,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);

  // Close on ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only close if not in fullscreen — let the player handle ESC in fullscreen
        const isFullscreen = playerRef.current?.state.fullscreen;
        if (!isFullscreen) {
          onClose();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Log player errors for debugging
  function handleError(detail: unknown) {
    console.error("[VideoPlayer] Playback error:", detail);
  }

  // Log remote playback events (AirPlay / Google Cast)
  function handleRemotePlaybackChange({
    type,
    state,
  }: MediaRemotePlaybackChangeEventDetail) {
    console.log(`[VideoPlayer] Remote playback: ${type} → ${state}`);
  }

  return (
    <div className="group relative w-full bg-black">
      {/* Close button — top-right corner */}
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-50 rounded-full bg-black/60 p-2 text-white/80 transition-colors hover:bg-black/80 hover:text-white"
        aria-label="Player schließen"
      >
        <X className="size-5" />
      </button>

      <MediaPlayer
        ref={playerRef}
        src={{ src, type: "video/mp4" }}
        title={title}
        autoPlay={autoPlay}
        playsInline
        crossOrigin=""
        onError={handleError}
        onRemotePlaybackChange={handleRemotePlaybackChange}
        className="aspect-video w-full overflow-hidden rounded-none md:rounded-lg"
      >
        <MediaProvider>
          {posterUrl && (
            <Poster
              className="absolute inset-0 block h-full w-full opacity-0 transition-opacity data-[visible]:opacity-100 [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
              src={posterUrl}
              alt={title}
            />
          )}
        </MediaProvider>
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          // Disable download button in the player — user has the existing download button
          download={false}
        />
      </MediaPlayer>
    </div>
  );
}
