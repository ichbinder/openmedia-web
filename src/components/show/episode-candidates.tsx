"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth";
import {
  getReleaseCandidates,
  requestEpisodes,
  type EpisodeRequestView,
  type ReleaseCandidate,
} from "@/lib/backend";

interface EpisodeCandidatesProps {
  tmdbId: number;
  season: number;
  episode: number;
  onRequested: (view: EpisodeRequestView) => void;
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; candidates: ReleaseCandidate[] };

const badgeClass =
  "rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground";

const formatSize = (bytes: number) =>
  `${(bytes / 1e9).toLocaleString("de-DE", { maximumFractionDigits: 1 })} GB`;

const rowLabel = (c: ReleaseCandidate) =>
  [c.qualityTier, c.releaseType, formatSize(c.sizeBytes)]
    .filter(Boolean)
    .join(" · ");

export function EpisodeCandidates({
  tmdbId,
  season,
  episode,
  onRequested,
}: EpisodeCandidatesProps) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busyGuid, setBusyGuid] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getReleaseCandidates(tmdbId, season, episode, token)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setState({ kind: "ready", candidates: res.data.candidates });
        } else {
          const message =
            (res.data as { error?: string } | null)?.error ??
            "Versionen konnten nicht geladen werden";
          setState({ kind: "error", message });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[EpisodeCandidates] load failed:", err);
        setState({
          kind: "error",
          message: "Versionen konnten nicht geladen werden",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbId, season, episode]);

  async function load(guid: string) {
    const token = getToken();
    if (!token || busyGuid) return;
    setBusyGuid(guid);
    try {
      const res = await requestEpisodes(
        { tmdbId, season, episode, guid },
        token,
      );
      const view = res.data?.requests?.find(
        (r) => r.season === season && r.episode === episode,
      );
      if (!res.ok || !view) {
        toast.error(res.data?.error ?? "Anfordern fehlgeschlagen");
        return;
      }
      onRequested(view);
      toast.success("Version angefordert");
    } catch (err) {
      console.error("[EpisodeCandidates] request failed:", err);
      toast.error("Anfordern fehlgeschlagen");
    } finally {
      setBusyGuid(null);
    }
  }

  if (state.kind === "loading")
    return (
      <p className="text-sm text-muted-foreground">Versionen werden gesucht…</p>
    );
  if (state.kind === "error")
    return <p className="text-sm text-muted-foreground">{state.message}</p>;
  if (!state.candidates.length)
    return (
      <p className="text-sm text-muted-foreground">
        Keine deutsche Version gefunden
      </p>
    );

  return (
    <ul className="flex flex-col gap-2">
      {state.candidates.map((c, i) => (
        <li key={c.guid} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-foreground">{rowLabel(c)}</span>
          {i === 0 && (
            <span className="rounded bg-cinema-gold/20 px-1.5 py-0.5 text-xs text-cinema-gold">
              Empfohlen
            </span>
          )}
          {c.germanSubtitles && <span className={badgeClass}>DE-Untertitel</span>}
          {c.audioDescription && <span className={badgeClass}>Hörfilm</span>}
          {c.languageSource === "name" && (
            <span className={badgeClass}>Sprache nur laut Name</span>
          )}
          <button
            type="button"
            onClick={() => load(c.guid)}
            disabled={busyGuid !== null}
            className="ml-auto rounded-md bg-cinema-gold/20 px-3 py-1 text-sm font-medium text-cinema-gold transition-colors hover:bg-cinema-gold/30 disabled:opacity-50"
          >
            Diese laden
          </button>
        </li>
      ))}
    </ul>
  );
}
