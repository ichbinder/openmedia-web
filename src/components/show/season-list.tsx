"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth";
import {
  getDownloadLink,
  getNzbShowByTmdb,
  type NzbShowInfo,
} from "@/lib/backend";
import type { EpisodeSummary, SeasonSummary } from "@/lib/tmdb";
import { qualityRank } from "@/lib/utils";
import { useDownloads } from "@/contexts/download-context";
import { VideoPlayer } from "@/components/movie/video-player";

type Version = NzbShowInfo["episodes"][number]["nzbFiles"][number];

interface SeasonListProps {
  showId: number;
  seasons: { summary: SeasonSummary; episodes: EpisodeSummary[] }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const label = (v: Version) => v.qualityTier || v.resolution;
const episodeCode = (season: number, episode: number) =>
  `S${pad(season)}E${pad(episode)}`;

export function SeasonList({ showId, seasons }: SeasonListProps) {
  const { getStreamUrl } = useDownloads();
  const [versions, setVersions] = useState<Map<string, Version[]>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ code: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getNzbShowByTmdb(showId, token)
      .then((res) => {
        if (cancelled || res.status === 404) return;
        if (!res.ok) {
          console.error("[SeasonList] versions request failed:", res.status);
          toast.error("Versionen konnten nicht geladen werden");
          return;
        }
        setVersions(
          new Map(
            res.data.show.episodes.map((e) => [
              episodeCode(e.season, e.episode),
              e.nzbFiles,
            ]),
          ),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[SeasonList] versions request failed:", err);
        toast.error("Versionen konnten nicht geladen werden");
      });
    return () => {
      cancelled = true;
    };
  }, [showId]);

  async function play(code: string, fileId: string) {
    setBusyId(fileId);
    try {
      const url = await getStreamUrl(fileId);
      if (url) setPlaying({ code, url });
      else toast.error("Stream konnte nicht gestartet werden");
    } catch {
      toast.error("Stream fehlgeschlagen");
    } finally {
      setBusyId(null);
    }
  }

  async function download(fileId: string) {
    const token = getToken();
    if (!token) return;
    setBusyId(fileId);
    try {
      const res = await getDownloadLink(fileId, token);
      if (res.ok && res.data?.url) window.open(res.data.url, "_blank");
      else toast.error("Download-Link konnte nicht abgerufen werden");
    } catch (err) {
      console.error("[SeasonList] download failed:", err);
      toast.error("Download fehlgeschlagen");
    } finally {
      setBusyId(null);
    }
  }

  const orderedSeasons = [...seasons].sort(
    (a, b) => a.summary.season_number - b.summary.season_number,
  );

  return (
    <section className="px-4 py-8 md:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Staffeln
      </h2>
      <div className="flex flex-col gap-8">
        {orderedSeasons.map(({ summary, episodes }) => (
          <div key={summary.season_number}>
            <h3 className="mb-3 text-lg font-semibold text-foreground">
              {summary.season_number === 0 ? "Specials" : summary.name}
            </h3>
            <ul className="flex flex-col gap-2">
              {[...episodes]
                .sort((a, b) => a.episode_number - b.episode_number)
                .map((episode) => {
                  const code = episodeCode(
                    summary.season_number,
                    episode.episode_number,
                  );
                  const files = versions.get(code) ?? [];
                  const best = files
                    .filter((f) => f.s3Key)
                    .sort(
                      (a, b) => qualityRank(label(a)) - qualityRank(label(b)),
                    )[0];
                  const busy = best !== undefined && busyId === best.id;

                  return (
                    <li
                      key={code}
                      id={code}
                      className="scroll-mt-20 rounded-lg border border-border/40 bg-card p-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="text-sm text-foreground">
                          <span className="text-muted-foreground">{code}</span>
                          {" · "}
                          {episode.name}
                          {episode.air_date && (
                            <span className="text-muted-foreground">
                              {" · "}
                              {new Date(episode.air_date).toLocaleDateString("de-DE")}
                            </span>
                          )}
                        </span>
                        {files.map((f) =>
                          label(f) ? (
                            <span
                              key={f.id}
                              className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                            >
                              {label(f)}
                            </span>
                          ) : null,
                        )}
                        {best && (
                          <div className="ml-auto flex gap-2">
                            <button
                              type="button"
                              onClick={() => play(code, best.id)}
                              disabled={busy}
                              className="flex items-center gap-1.5 rounded-md bg-cinema-gold px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-cinema-gold/90 disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Play className="size-3.5 fill-black" />
                              )}
                              Abspielen
                            </button>
                            <button
                              type="button"
                              onClick={() => download(best.id)}
                              disabled={busy}
                              className="flex items-center gap-1.5 rounded-md bg-cinema-gold/20 px-3 py-1.5 text-sm font-medium text-cinema-gold transition-colors hover:bg-cinema-gold/30 disabled:opacity-50"
                            >
                              <Download className="size-3.5" />
                              Laden
                            </button>
                          </div>
                        )}
                      </div>
                      {playing?.code === code && (
                        <div className="mt-3">
                          <VideoPlayer
                            src={playing.url}
                            title={`${code} · ${episode.name}`}
                            onClose={() => setPlaying(null)}
                            autoPlay
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
