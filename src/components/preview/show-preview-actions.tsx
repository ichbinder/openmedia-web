"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PreviewData } from "@/app/actions/preview";
import { getToken } from "@/lib/auth";
import { getNzbShowByTmdb, requestEpisodes } from "@/lib/backend";
import { nextEpisode, type EpisodeCode } from "@/lib/next-episode";

type Next =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "done"; episode: EpisodeCode | null };

const buttonClass =
  "flex h-9 shrink-0 items-center rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors";

export function ShowPreviewActions({
  showId,
  data,
}: {
  showId: number;
  data: PreviewData | null;
}) {
  const router = useRouter();
  const [token] = useState(getToken);
  const [next, setNext] = useState<Next>({ state: "loading" });
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data || !token) return;
    let cancelled = false;
    getNzbShowByTmdb(showId, token)
      .then((res) => {
        if (cancelled) return;
        if (res.status !== 404 && !res.ok) {
          console.error("[ShowPreviewActions] lookup failed:", res.status);
          setNext({ state: "failed" });
          return;
        }
        const had = res.ok
          ? [
              ...(res.data.myLibrary ?? []),
              ...res.data.myRequests.filter((r) => r.status !== "expired"),
            ]
          : [];
        setNext({
          state: "done",
          episode: nextEpisode(had, data.seasons, data.lastAired),
        });
      })
      .catch((err) => {
        console.error("[ShowPreviewActions] lookup failed:", err);
        if (!cancelled) setNext({ state: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [showId, data, token]);

  async function download(episode: EpisodeCode) {
    if (!token) {
      router.push("/login");
      return;
    }
    if (busy || requested) return;
    setBusy(true);
    try {
      const res = await requestEpisodes(
        { tmdbId: showId, season: episode.season, episode: episode.episode },
        token,
      );
      if (!res.ok || !res.data?.requests) {
        toast.error(res.data?.error ?? "Anfordern fehlgeschlagen");
        return;
      }
      setRequested(true);
      toast.success("Folge angefragt");
    } catch (err) {
      console.error("[ShowPreviewActions] request failed:", err);
      toast.error("Anfordern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  const episode = next.state === "done" ? next.episode : null;
  const showLabel = data && (!token || next.state === "done");
  const label = !token
    ? ""
    : episode
      ? `Nächste: Staffel ${episode.season}, Folge ${episode.episode}`
      : "Alles da";
  const canDownload = !!data && (!token || episode);

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-xs text-muted-foreground">
        {showLabel ? label : ""}
      </p>
      <div className="flex h-9 items-center gap-2">
        {canDownload && (
          <button
            disabled={busy || requested}
            onClick={() => download(episode ?? { season: 1, episode: 1 })}
            className={`${buttonClass} bg-cinema-gold text-black hover:bg-cinema-gold/90 disabled:opacity-50`}
          >
            Herunterladen
          </button>
        )}
        <Link
          href={`/serie/${showId}`}
          className={`${buttonClass} bg-muted text-foreground hover:bg-muted/80`}
        >
          Mehr
        </Link>
      </div>
    </div>
  );
}
