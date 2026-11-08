"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";
import { getPreview, type PreviewData } from "@/app/actions/preview";
import { getBackdropUrl } from "@/lib/tmdb";
import { placePreview } from "./place-preview";

const OPEN_DELAY_MS = 1000;
const PREVIEW_WIDTH = 360;
const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";

const previewCache = new Map<string, Promise<PreviewData | null>>();

function loadPreview(kind: "movie" | "tv", id: number) {
  const key = `${kind}:${id}`;
  let preview = previewCache.get(key);
  if (!preview) {
    preview = getPreview(kind, id)
      .catch(() => null)
      .then((data) => {
        if (!data) previewCache.delete(key);
        return data;
      });
    previewCache.set(key, preview);
  }
  return preview;
}

function canHover() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover)").matches
  );
}

function trailerUrl(key: string) {
  return `${YOUTUBE_ORIGIN}/embed/${key}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${key}&enablejsapi=1`;
}

interface PreviewTileProps {
  kind: "movie" | "tv";
  id: number;
  title: string;
  voteAverage: number;
  year: string;
  children: React.ReactNode;
  actions: (data: PreviewData | null) => React.ReactNode;
}

export function PreviewTile({
  kind,
  id,
  title,
  voteAverage,
  year,
  children,
  actions,
}: PreviewTileProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PreviewData | null>(null);
  const [muted, setMuted] = useState(true);
  const tileRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function close() {
    clearTimeout(timerRef.current);
    setOpen(false);
  }

  function handleMouseEnter() {
    if (!canHover()) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setMuted(true);
      setOpen(true);
      loadPreview(kind, id).then(setData);
    }, OPEN_DELAY_MS);
  }

  function toggleSound() {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: muted ? "unMute" : "mute",
        args: [],
      }),
      YOUTUBE_ORIGIN,
    );
    setMuted(!muted);
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", dismissOnEscape);
    window.addEventListener("scroll", dismiss);
    return () => {
      document.removeEventListener("keydown", dismissOnEscape);
      window.removeEventListener("scroll", dismiss);
    };
  }, [open]);

  useLayoutEffect(() => {
    const tile = tileRef.current;
    const preview = previewRef.current;
    if (!open || !tile || !preview) return;
    const place = () => {
      const { left, top } = placePreview(
        tile.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        { width: PREVIEW_WIDTH, height: preview.offsetHeight },
      );
      preview.style.left = `${left}px`;
      preview.style.top = `${top}px`;
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [open, data]);

  const backdropUrl = getBackdropUrl(data?.backdropPath ?? null, "w780");
  const seasons = data?.numberOfSeasons;
  const meta = [
    year,
    kind === "tv" && seasons
      ? `${seasons} ${seasons === 1 ? "Staffel" : "Staffeln"}`
      : "",
    data?.genres.join(", ") ?? "",
  ].filter(Boolean);

  return (
    <div ref={tileRef} onMouseEnter={handleMouseEnter} onMouseLeave={close}>
      {children}
      {open &&
        createPortal(
          <div
            ref={previewRef}
            role="dialog"
            aria-label={title}
            style={{ width: PREVIEW_WIDTH }}
            className="fixed top-0 left-0 z-50 overflow-hidden rounded-xl bg-card text-card-foreground shadow-2xl shadow-black/80 ring-1 ring-cinema-gold/40"
          >
            <div className="relative aspect-video w-full bg-muted">
              {data?.trailerKey ? (
                <>
                  <iframe
                    ref={iframeRef}
                    src={trailerUrl(data.trailerKey)}
                    title={`Trailer: ${title}`}
                    allow="autoplay; encrypted-media"
                    className="pointer-events-none absolute inset-0 size-full"
                  />
                  <button
                    type="button"
                    onClick={toggleSound}
                    aria-label={muted ? "Ton an" : "Ton aus"}
                    className="absolute right-2 bottom-2 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                  >
                    {muted ? (
                      <VolumeX className="size-4" />
                    ) : (
                      <Volume2 className="size-4" />
                    )}
                  </button>
                </>
              ) : (
                backdropUrl && (
                  <Image
                    src={backdropUrl}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes={`${PREVIEW_WIDTH}px`}
                  />
                )
              )}
            </div>
            <div className="flex flex-col gap-2 p-4">
              <h3 className="text-base font-semibold text-foreground">
                {title}
              </h3>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="text-cinema-gold">{`★ ${voteAverage.toFixed(1)}`}</span>
                {meta.length > 0 && <span>{meta.join(" · ")}</span>}
              </div>
              {data?.overview && (
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {data.overview}
                </p>
              )}
              {actions(data)}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
