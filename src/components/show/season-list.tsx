"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth";
import {
  getDownloadLink,
  getNzbShowByTmdb,
  requestEpisodes,
  type EpisodeRequestView,
  type NzbShowInfo,
} from "@/lib/backend";
import type { EpisodeSummary, SeasonSummary } from "@/lib/tmdb";
import { qualityRank } from "@/lib/utils";
import { useDownloads } from "@/contexts/download-context";
import { VideoPlayer } from "@/components/movie/video-player";
import { EpisodeCandidates } from "./episode-candidates";

type Version = NzbShowInfo["episodes"][number]["nzbFiles"][number];

interface SeasonListProps {
  showId: number;
  seasons: {
    summary: SeasonSummary;
    episodes: EpisodeSummary[];
    failed: boolean;
  }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const label = (v: Version) => v.qualityTier || v.resolution;
const episodeCode = (season: number, episode: number) =>
  `S${pad(season)}E${pad(episode)}`;
const isPlayable = (files: Version[] | undefined) =>
  !!files?.some((f) => f.s3Key && f.status !== "broken");
const bestVersion = (files: Version[], key: "s3Key" | "s3StreamKey") =>
  files
    .filter((f) => f[key])
    .sort((a, b) => qualityRank(label(a)) - qualityRank(label(b)))[0];

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function requestNote(r: EpisodeRequestView) {
  if (r.status === "downloading") return "Wird geladen…";
  if (r.status === "expired") return "Keine Version gefunden";
  if (r.status === "searching" || !r.waitReason) return "Wird gesucht…";
  return {
    no_german: "Noch keine deutsche Fassung",
    budget: "Tageslimit erreicht, später erneut",
    indexer_error: "Indexer nicht erreichbar, später erneut",
  }[r.waitReason];
}

const requestButtonClass =
  "flex items-center gap-1.5 rounded-md bg-cinema-gold/20 px-3 py-1.5 text-sm font-medium text-cinema-gold transition-colors hover:bg-cinema-gold/30 disabled:opacity-50";

export function SeasonList({ showId, seasons }: SeasonListProps) {
  const { getStreamUrl } = useDownloads();
  const [versions, setVersions] = useState<Map<string, Version[]>>(new Map());
  const [requests, setRequests] = useState<Map<string, EpisodeRequestView>>(
    new Map(),
  );
  const [hasToken, setHasToken] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const [requestingKeys, setRequestingKeys] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ code: string; url: string } | null>(
    null,
  );

  const playRequest = useRef(0);
  const autoPlayed = useRef(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    // client-only values must be set after mount to keep SSR markup stable
    /* eslint-disable react-hooks/set-state-in-effect */
    setHasToken(true);
    setToday(localToday());
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    getNzbShowByTmdb(showId, token)
      .then((res) => {
        if (cancelled || res.status === 404) return;
        if (!res.ok) {
          console.error("[SeasonList] versions request failed:", res.status);
          toast.error("Versionen konnten nicht geladen werden");
          return;
        }
        const loaded = new Map(
          res.data.show.episodes.map((e) => [
            episodeCode(e.season, e.episode),
            e.nzbFiles,
          ]),
        );
        setVersions(loaded);
        const initial = (res.data.myRequests ?? []).map(
          (r) => [episodeCode(r.season, r.episode), r] as const,
        );
        setRequests((prev) => new Map([...initial, ...prev]));
        const code = window.location.hash.slice(1);
        const stream = bestVersion(loaded.get(code) ?? [], "s3StreamKey");
        if (stream && !autoPlayed.current) {
          autoPlayed.current = true;
          void play(code, stream.id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[SeasonList] versions request failed:", err);
        toast.error("Versionen konnten nicht geladen werden");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId]);

  async function play(code: string, fileId: string) {
    const request = ++playRequest.current;
    setBusyId(fileId);
    try {
      const url = await getStreamUrl(fileId);
      if (request !== playRequest.current) return;
      if (url) setPlaying({ code, url });
      else toast.error("Stream konnte nicht gestartet werden");
    } catch {
      if (request === playRequest.current) toast.error("Stream fehlgeschlagen");
    } finally {
      setBusyId((prev) => (prev === fileId ? null : prev));
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
      setBusyId((prev) => (prev === fileId ? null : prev));
    }
  }

  async function request(
    key: string,
    body: { season: number; episode?: number },
  ) {
    const token = getToken();
    if (!token || requestingKeys.has(key)) return;
    setRequestingKeys((prev) => new Set(prev).add(key));
    try {
      const res = await requestEpisodes({ tmdbId: showId, ...body }, token);
      if (!res.ok || !res.data?.requests) {
        toast.error(
          res.data?.reason === "indexer_not_configured"
            ? "Indexer ist nicht eingerichtet"
            : (res.data?.error ?? "Anfordern fehlgeschlagen"),
        );
        return;
      }
      const returned = res.data.requests;
      setRequests((prev) => {
        const next = new Map(prev);
        returned.forEach((r) => next.set(episodeCode(r.season, r.episode), r));
        return next;
      });
      if (body.episode !== undefined && !returned.length) {
        toast.error("Folge bei TMDB nicht gefunden");
      } else if (body.episode === undefined) {
        toast.success(
          returned.length
            ? `${returned.length} Folgen angefordert`
            : "Keine erschienenen Folgen ohne Version",
        );
      }
    } catch (err) {
      console.error("[SeasonList] request failed:", err);
      toast.error("Anfordern fehlgeschlagen");
    } finally {
      setRequestingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function toggleExpanded(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }

  function onRequested(view: EpisodeRequestView) {
    setRequests((prev) =>
      new Map(prev).set(episodeCode(view.season, view.episode), view),
    );
  }

  const isAired = (e: EpisodeSummary) =>
    !!e.air_date && today !== null && e.air_date <= today;
  const orderedSeasons = [...seasons].sort(
    (a, b) => a.summary.season_number - b.summary.season_number,
  );

  return (
    <section className="px-4 py-8 md:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Staffeln
      </h2>
      <div className="flex flex-col gap-8">
        {orderedSeasons.map(({ summary, episodes, failed }) => {
          const seasonKey = `season-${summary.season_number}`;
          const canRequestSeason =
            hasToken &&
            episodes.some((e) => {
              const c = episodeCode(summary.season_number, e.episode_number);
              return (
                isAired(e) &&
                !isPlayable(versions.get(c)) &&
                (!requests.has(c) ||
                  ["done", "expired"].includes(requests.get(c)!.status))
              );
            });
          return (
            <div key={summary.season_number}>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-lg font-semibold text-foreground">
                  {summary.season_number === 0 ? "Specials" : summary.name}
                </h3>
                {canRequestSeason && (
                  <button
                    type="button"
                    onClick={() =>
                      request(seasonKey, { season: summary.season_number })
                    }
                    disabled={requestingKeys.has(seasonKey)}
                    className={requestButtonClass}
                  >
                    Staffel anfordern
                  </button>
                )}
              </div>
              {failed && (
                <p className="mb-3 text-sm text-muted-foreground">
                  Staffel konnte gerade nicht geladen werden.
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {[...episodes]
                  .sort((a, b) => a.episode_number - b.episode_number)
                  .map((episode) => {
                    const code = episodeCode(
                      summary.season_number,
                      episode.episode_number,
                    );
                    const files = versions.get(code) ?? [];
                    const streamVersion = bestVersion(files, "s3StreamKey");
                    const downloadVersion = bestVersion(files, "s3Key");
                    const hasVersion = isPlayable(files);
                    const req = requests.get(code);
                    const canRequest = hasToken && isAired(episode);
                    const busy = [streamVersion, downloadVersion].some(
                      (v) => v !== undefined && busyId === v.id,
                    );

                    return (
                      <li
                        key={code}
                        id={code}
                        className="scroll-mt-20 rounded-lg border border-border/40 bg-card p-3"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className="text-sm text-foreground">
                            <span className="text-muted-foreground">
                              {code}
                            </span>
                            {" · "}
                            {episode.name}
                            {episode.air_date && (
                              <span className="text-muted-foreground">
                                {" · "}
                                {new Date(episode.air_date).toLocaleDateString(
                                  "de-DE",
                                )}
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
                          <div className="ml-auto flex gap-2">
                            {streamVersion && (
                              <button
                                type="button"
                                onClick={() => play(code, streamVersion.id)}
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
                            )}
                            {downloadVersion && (
                              <button
                                type="button"
                                onClick={() => download(downloadVersion.id)}
                                disabled={busy}
                                className="flex items-center gap-1.5 rounded-md bg-cinema-gold/20 px-3 py-1.5 text-sm font-medium text-cinema-gold transition-colors hover:bg-cinema-gold/30 disabled:opacity-50"
                              >
                                <Download className="size-3.5" />
                                Laden
                              </button>
                            )}
                            {canRequest && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(code)}
                                aria-expanded={expanded.has(code)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Versionen
                              </button>
                            )}
                            {!hasVersion && hasToken && req && req.status !== "done" && (
                              <span className="text-sm text-muted-foreground">
                                {requestNote(req)}
                              </span>
                            )}
                            {!hasVersion &&
                              canRequest &&
                              (!req || req.status === "expired" || req.status === "done") && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    request(code, {
                                      season: summary.season_number,
                                      episode: episode.episode_number,
                                    })
                                  }
                                  disabled={requestingKeys.has(code)}
                                  className={requestButtonClass}
                                >
                                  {req ? "Erneut anfordern" : "Anfordern"}
                                </button>
                              )}
                          </div>
                        </div>
                        {canRequest && expanded.has(code) && (
                          <div className="mt-3">
                            <EpisodeCandidates
                              tmdbId={showId}
                              season={summary.season_number}
                              episode={episode.episode_number}
                              onRequested={onRequested}
                            />
                          </div>
                        )}
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
          );
        })}
      </div>
    </section>
  );
}
