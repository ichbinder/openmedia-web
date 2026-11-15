"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
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

import { NextEpisodeOverlay } from "@/components/player/next-episode-overlay";
import { ResumePrompt } from "@/components/player/resume-prompt";
import { getToken } from "@/lib/auth";
import { useDownloads } from "@/contexts/download-context";
import {
  getNextEpisode,
  reportProgress,
  requestEpisodes,
  type NextEpisode,
  type Resume,
} from "@/lib/backend";
import { nextEpisodePhase, shouldAskResume } from "@/lib/progress";
import { createProgressReporter, type ProgressBody } from "@/lib/progress-reporter";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

/** Derive MIME type from the URL path/extension. Falls back to video/mp4. */
function getMimeType(url: string): "video/mp4" | "video/webm" | "video/ogg" | "video/avi" {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".webm")) return "video/webm";
    if (pathname.endsWith(".ogg") || pathname.endsWith(".ogv")) return "video/ogg";
    if (pathname.endsWith(".avi")) return "video/avi";
  } catch {
    // Presigned URLs may have complex query strings — fallback is fine
  }
  return "video/mp4";
}

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
  /** File the playback position is reported for */
  nzbFileId: string;
  /** Saved position; triggers the resume prompt when worth asking */
  resume?: Resume | null;
  /** Start position in seconds without asking */
  startAt?: number;
}

function sendProgress(body: ProgressBody, beacon: boolean) {
  if (beacon) {
    navigator.sendBeacon(
      "/api/backend/progress",
      new Blob([JSON.stringify(body)], { type: "application/json" }),
    );
    return;
  }
  const token = getToken();
  if (token) reportProgress(body, token).catch(() => {});
}

export function VideoPlayer({
  src: initialSrc,
  title: initialTitle,
  posterUrl,
  onClose,
  autoPlay = false,
  nzbFileId: initialNzbFileId,
  resume = null,
  startAt,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const { getStream } = useDownloads();
  const [current, setCurrent] = useState({
    nzbFileId: initialNzbFileId,
    src: initialSrc,
    title: initialTitle,
  });
  const { nzbFileId, src, title } = current;
  const [chained, setChained] = useState(false);
  const [next, setNext] = useState<NextEpisode | null>(null);
  const [remainingSec, setRemainingSec] = useState(Infinity);
  const [ended, setEnded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [asking, setAsking] = useState(
    () => startAt === undefined && shouldAskResume(resume),
  );
  const reporter = useMemo(
    () => createProgressReporter(sendProgress, nzbFileId),
    [nzbFileId],
  );

  useEffect(() => {
    const flushBeacon = () => reporter.flush(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushBeacon();
    };
    window.addEventListener("pagehide", flushBeacon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushBeacon);
      document.removeEventListener("visibilitychange", onVisibility);
      reporter.flush(true);
      reporter.dispose();
    };
  }, [reporter]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getNextEpisode(nzbFileId, token)
      .then((res) => {
        if (!cancelled && res.ok) setNext(res.data?.next ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [nzbFileId]);

  const switching = useRef(false);
  async function playNext(): Promise<boolean> {
    if (!next?.nzbFileId) return false;
    if (switching.current) return true;
    switching.current = true;
    let stream;
    try {
      stream = await getStream(next.nzbFileId);
    } catch {
      stream = null;
    } finally {
      switching.current = false;
    }
    if (!stream) return false;
    pendingSeek.current = undefined;
    setNext(null);
    setRemainingSec(Infinity);
    setEnded(false);
    setDismissed(false);
    setChained(true);
    setCurrent({
      nzbFileId: next.nzbFileId,
      src: stream.url,
      title: `S${next.season} · F${next.episode}${next.titleDe ? ` · ${next.titleDe}` : ""}`,
    });
    return true;
  }

  async function downloadNext(): Promise<boolean> {
    const token = getToken();
    if (!token || !next) return false;
    try {
      const res = await requestEpisodes(
        { tmdbId: next.showTmdbId, season: next.season, episode: next.episode },
        token,
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  const pendingSeek = useRef<number | undefined>(startAt);
  function applyPendingSeek() {
    const player = playerRef.current;
    if (pendingSeek.current === undefined || !player?.state.canPlay) return;
    player.currentTime = pendingSeek.current;
    pendingSeek.current = undefined;
  }

  function currentDuration() {
    return playerRef.current?.state.duration ?? NaN;
  }

  function startPlayback(from?: number) {
    const player = playerRef.current;
    setAsking(false);
    if (!player) return;
    pendingSeek.current = from;
    applyPendingSeek();
    void player.play();
  }

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
        src={{ src, type: getMimeType(src) }}
        title={title}
        autoPlay={(autoPlay || chained) && !asking}
        onCanPlay={applyPendingSeek}
        onTimeUpdate={({ currentTime }) => {
          reporter.tick(currentTime, currentDuration(), !playerRef.current?.state.paused);
          setRemainingSec(Math.floor(currentDuration() - currentTime));
        }}
        onPlay={() => setEnded(false)}
        onSeeking={() => setEnded(false)}
        onPause={() => reporter.pause(playerRef.current?.currentTime ?? 0, currentDuration())}
        onSeeked={(currentTime) => reporter.seeked(currentTime, currentDuration())}
        onEnded={() => {
          reporter.ended(playerRef.current?.currentTime ?? 0, currentDuration());
          setEnded(true);
        }}
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
        {next && !dismissed && (
          <NextEpisodeOverlay
            phase={nextEpisodePhase(remainingSec, ended, next)}
            next={next}
            onPlayNext={playNext}
            onCancel={() => setDismissed(true)}
            onDownload={downloadNext}
          />
        )}
        {asking && resume && (
          <ResumePrompt
            positionSec={resume.positionSec}
            onResume={() => startPlayback(resume.positionSec)}
            onRestart={() => startPlayback()}
          />
        )}
      </MediaPlayer>
    </div>
  );
}
