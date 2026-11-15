"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Film, X } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth";
import {
  getContinueWatching,
  hideContinue,
  requestEpisodes,
  type ContinueItem,
  type Resume,
} from "@/lib/backend";
import { getPosterUrl } from "@/lib/tmdb";
import { useDownloads } from "@/contexts/download-context";
import { VideoPlayer } from "@/components/movie/video-player";
import { WatchProgress } from "@/components/ui/watch-progress";
import { requestNote } from "@/components/show/season-list";

const itemKey = (i: ContinueItem) => `${i.kind}-${i.tmdbId}`;
const RELOAD_AFTER_CLOSE_MS = 500;

export function ContinueRow() {
  const { getStream } = useDownloads();
  const [items, setItems] = useState<ContinueItem[]>([]);
  const [playing, setPlaying] = useState<{
    item: ContinueItem;
    url: string;
    resume: Resume | null;
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await getContinueWatching(token);
      if (mounted.current && res.ok) setItems(res.data.items);
    } catch (err) {
      console.error("[ContinueRow] load failed:", err);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; setState runs after await, the rule cannot tell
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  if (items.length === 0) return null;

  async function guarded(item: ContinueItem, action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyKey(itemKey(item));
    try {
      await action();
    } finally {
      inFlight.current = false;
      setBusyKey(null);
    }
  }

  function play(item: ContinueItem) {
    return guarded(item, async () => {
      try {
        const stream = await getStream(item.nzbFileId!);
        if (stream) setPlaying({ item, ...stream });
        else toast.error("Stream konnte nicht gestartet werden");
      } catch {
        toast.error("Stream fehlgeschlagen");
      }
    });
  }

  function closePlayer() {
    setPlaying(null);
    setTimeout(() => void load(), RELOAD_AFTER_CLOSE_MS);
  }

  async function hide(item: ContinueItem) {
    const token = getToken();
    if (!token) return;
    const index = items.findIndex((i) => itemKey(i) === itemKey(item));
    setItems((prev) => prev.filter((i) => itemKey(i) !== itemKey(item)));
    const res = await hideContinue(item.kind === "movie" ? "movie" : "show", item.tmdbId, token).catch(
      () => null,
    );
    if (res?.ok) return;
    setItems((prev) => [...prev.slice(0, index), item, ...prev.slice(index)]);
    toast.error("Entfernen fehlgeschlagen");
  }

  function download(item: ContinueItem) {
    return guarded(item, async () => {
      const token = getToken();
      if (!token) return;
      const res = await requestEpisodes(
        { tmdbId: item.tmdbId, season: item.season!, episode: item.episode! },
        token,
      ).catch(() => null);
      const created = res?.ok
        ? res.data?.requests?.find((r) => r.season === item.season && r.episode === item.episode)
        : undefined;
      if (created) {
        setItems((prev) =>
          prev.map((i) => (itemKey(i) === itemKey(item) ? { ...i, request: created } : i)),
        );
      } else {
        toast.error("Anfrage fehlgeschlagen");
      }
    });
  }

  return (
    <section aria-label="Weiterschauen" className="mx-auto w-full max-w-7xl px-4 pt-6">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Weiterschauen</h2>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => {
          const poster = getPosterUrl(item.posterPath, "w342");
          const isEpisode = item.kind === "episode";
          const pending = item.request && item.request.status !== "done";
          const busy = busyKey === itemKey(item);
          const body = (
            <>
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
                {poster ? (
                  <Image
                    src={poster}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="160px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Film className="size-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0">
                  <WatchProgress
                    positionSec={item.positionSec}
                    durationSec={item.durationSec}
                  />
                </div>
              </div>
              <div className="p-2 text-left">
                <h3 className="truncate text-sm font-medium text-foreground">
                  {item.title}
                </h3>
                {isEpisode && (
                  <p className="text-xs text-muted-foreground">
                    S{item.season} · F{item.episode}
                  </p>
                )}
              </div>
            </>
          );

          return (
            <li
              key={itemKey(item)}
              className="relative w-40 shrink-0 overflow-hidden rounded-lg bg-card"
            >
              {item.nzbFileId ? (
                <button
                  type="button"
                  onClick={() => play(item)}
                  disabled={busy}
                  aria-busy={busy}
                  className="block w-full disabled:opacity-60"
                >
                  {body}
                </button>
              ) : isEpisode ? (
                <div>
                  {body}
                  <div className="px-2 pb-2">
                    {pending ? (
                      <span className="text-xs text-muted-foreground">
                        {requestNote(item.request!)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => download(item)}
                        disabled={busy}
                        className="rounded-md disabled:opacity-60 bg-cinema-gold/20 px-2 py-1 text-xs font-medium text-cinema-gold hover:bg-cinema-gold/30"
                      >
                        Herunterladen
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <Link href={`/movie/${item.tmdbId}`} className="block">
                  {body}
                </Link>
              )}
              <button
                type="button"
                onClick={() => hide(item)}
                aria-label="Aus Weiterschauen entfernen"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {playing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="w-full max-w-6xl">
            <VideoPlayer
              key={playing.item.nzbFileId}
              src={playing.url}
              nzbFileId={playing.item.nzbFileId!}
              title={playing.item.title}
              startAt={playing.resume?.positionSec}
              onClose={closePlayer}
              autoPlay
            />
          </div>
        </div>
      )}
    </section>
  );
}
