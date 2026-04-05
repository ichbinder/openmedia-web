"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { getToken } from "@/lib/auth";
import {
  type DownloadJob,
  type NzbFileInfo,
  createDownloadJob,
  getDownloadJob,
  getDownloadJobs,
  deleteDownloadJob,
  getNzbMovieByTmdb,
  getDownloadLink,
  getStreamLink as getStreamLinkApi,
} from "@/lib/backend";

// ── Constants ────────────────────────────────────────────────
/** Hours after which a non-terminal job is considered stale on the client */
const CLIENT_STALE_HOURS = 2;

// ── Status Labels ────────────────────────────────────────────

type JobStatus = DownloadJob["status"];

export function getStatusLabel(status: JobStatus): string {
  switch (status) {
    case "queued": return "Wartend…";
    case "provisioning": return "Server wird gestartet…";
    case "downloading": return "Wird heruntergeladen…";
    case "uploading": return "Wird hochgeladen…";
    case "completed": return "Bereit";
    case "failed": return "Fehlgeschlagen";
  }
}

/** Check if a job appears stuck (non-terminal for too long). */
export function isJobStale(job: DownloadJob): boolean {
  if (job.status === "completed" || job.status === "failed") return false;
  const updatedAt = new Date(job.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return false;
  const ageHours = (Date.now() - updatedAt) / (1000 * 60 * 60);
  return ageHours >= CLIENT_STALE_HOURS;
}

// ── Context Types ────────────────────────────────────────────

interface DownloadContextValue {
  /** All download jobs for the current user */
  jobs: DownloadJob[];
  /** Start a download for an NZB file */
  startDownload: (nzbFileId: string) => Promise<DownloadJob | null>;
  /** Cancel/delete a queued job */
  cancelJob: (jobId: string) => Promise<void>;
  /** Get a specific job by NZB file ID */
  getJobForFile: (nzbFileId: string) => DownloadJob | undefined;
  /** Check if a TMDB movie has NZB files available */
  checkAvailability: (tmdbId: number) => Promise<NzbFileInfo[]>;
  /** Get presigned download URL for an NZB file (original) */
  getLink: (nzbFileId: string) => Promise<string | null>;
  /** Get presigned stream URL for an NZB file (browser-compatible MP4) */
  getStreamUrl: (nzbFileId: string) => Promise<string | null>;
  /** Number of active (non-terminal) jobs */
  activeCount: number;
  /** Jobs that are completed (ready for download) */
  completedJobs: DownloadJob[];
  /** Loading state */
  isLoading: boolean;
  /** Refresh jobs from API */
  refresh: () => Promise<DownloadJob[] | void>;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

// ── Poll configuration ───────────────────────────────────────
/** Fast poll interval during upload phase (upload completes quickly) */
const POLL_INTERVAL_FAST_MS = 3_000;
/** Initial poll interval when downloads are active */
const POLL_INTERVAL_INITIAL_MS = 5_000;
/** Maximum poll interval after backoff (kept short so status changes are visible within seconds) */
const POLL_INTERVAL_MAX_MS = 15_000;
/** Backoff multiplier per unchanged poll cycle */
const POLL_BACKOFF_FACTOR = 1.5;

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef(POLL_INTERVAL_INITIAL_MS);
  const lastJobsHashRef = useRef("");
  /** Track previous job statuses to detect transitions */
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());

  // ── Notify on status transitions ──────────────────────────
  const notifyTransitions = useCallback((freshJobs: DownloadJob[]) => {
    const prevMap = prevStatusMapRef.current;

    for (const job of freshJobs) {
      const prevStatus = prevMap.get(job.id);
      if (!prevStatus) continue; // first fetch, no transition
      if (prevStatus === job.status) continue;

      const movieTitle = job.nzbFile?.movie?.titleDe || job.nzbFile?.movie?.titleEn || "Film";

      if (job.status === "completed" && prevStatus !== "completed") {
        toast.success(`${movieTitle} ist bereit`, {
          description: "Du kannst den Film jetzt herunterladen.",
          duration: 8_000,
        });
      } else if (job.status === "failed" && prevStatus !== "failed") {
        toast.error(`Download fehlgeschlagen: ${movieTitle}`, {
          description: job.error || "Unbekannter Fehler",
          duration: 10_000,
        });
      }
    }

    // Update previous status map
    const newMap = new Map<string, string>();
    for (const job of freshJobs) {
      newMap.set(job.id, job.status);
    }
    prevStatusMapRef.current = newMap;
  }, []);

  // ── Fetch all jobs from API ──────────────────────────────
  // Side-effect-free: returns fresh jobs without touching state.
  // Returns null on error/no-token, or DownloadJob[] (possibly empty) on success.
  const fetchJobsRaw = useCallback(async (): Promise<DownloadJob[] | null> => {
    const token = getToken();
    if (!token) return null;

    const res = await getDownloadJobs(token);
    if (res.ok && res.data?.jobs) {
      return res.data.jobs;
    }
    return null;
  }, []);

  // Convenience wrapper that applies side-effects (used by non-polling callers)
  const fetchJobs = useCallback(async (): Promise<DownloadJob[]> => {
    const freshJobs = await fetchJobsRaw();
    if (freshJobs === null) return []; // error/no-token — don't touch state
    notifyTransitions(freshJobs);
    setJobs(freshJobs);
    return freshJobs;
  }, [fetchJobsRaw, notifyTransitions]);

  // ── Load jobs on login ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (user) {
      setIsLoading(true);
      // First fetch: populate prevStatusMap without triggering toasts
      const token = getToken();
      if (token) {
        getDownloadJobs(token).then((res) => {
          if (cancelled) return;
          if (res.ok && res.data?.jobs) {
            const initialMap = new Map<string, string>();
            for (const job of res.data.jobs) {
              initialMap.set(job.id, job.status);
            }
            prevStatusMapRef.current = initialMap;
            setJobs(res.data.jobs);
          }
          setIsLoading(false);
        }).catch(() => {
          if (!cancelled) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    } else {
      setJobs([]);
      setIsLoading(false);
      prevStatusMapRef.current = new Map();
    }
    return () => { cancelled = true; };
  }, [user]);

  // ── Derived state ─────────────────────────────────────────
  const hasActive = jobs.some(
    (j) => j.status !== "completed" && j.status !== "failed",
  );

  // ── Adaptive polling with exponential backoff ────────────
  // Polls fast when downloads are progressing, slows down
  // when nothing changes (e.g. stuck provisioning).
  useEffect(() => {
    let cancelled = false;

    if (!hasActive || !user) {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
      // Reset interval for next active download
      pollIntervalRef.current = POLL_INTERVAL_INITIAL_MS;
      lastJobsHashRef.current = "";
      return;
    }

    const schedulePoll = () => {
      pollRef.current = setTimeout(async () => {
        const freshJobs = await fetchJobsRaw();

        // Don't continue if effect was cleaned up during fetch
        if (cancelled) return;

        // null = error/no-token — skip this poll cycle
        if (freshJobs === null) {
          schedulePoll();
          return;
        }

        // Apply side-effects only after cancel check
        notifyTransitions(freshJobs);
        setJobs(freshJobs);

        // Compute hash from freshly fetched data (not stale closure)
        const freshActive = freshJobs.filter(
          (j) => j.status !== "completed" && j.status !== "failed",
        );

        // If no active jobs remain, stop polling immediately.
        // The useEffect will clean up on re-render when hasActive flips.
        if (freshActive.length === 0) {
          pollIntervalRef.current = POLL_INTERVAL_INITIAL_MS;
          lastJobsHashRef.current = "";
          return; // Don't schedule another poll
        }

        const currentHash = freshActive
          .map((j) => `${j.id}:${j.status}:${j.progress}`)
          .sort()
          .join("|");

        // Upload phase: poll fast because uploads complete quickly with rclone
        const hasUploading = freshActive.some((j) => j.status === "uploading");

        if (hasUploading) {
          // Always poll fast during upload — completion is imminent
          pollIntervalRef.current = POLL_INTERVAL_FAST_MS;
          lastJobsHashRef.current = currentHash;
        } else if (currentHash === lastJobsHashRef.current) {
          // Nothing changed → backoff
          pollIntervalRef.current = Math.min(
            pollIntervalRef.current * POLL_BACKOFF_FACTOR,
            POLL_INTERVAL_MAX_MS,
          );
        } else {
          // Progress detected → reset to fast polling
          pollIntervalRef.current = POLL_INTERVAL_INITIAL_MS;
          lastJobsHashRef.current = currentHash;
        }

        schedulePoll();
      }, pollIntervalRef.current);
    };

    schedulePoll();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [hasActive, user, fetchJobsRaw, notifyTransitions]);

  // ── Start a download ─────────────────────────────────────
  const startDownload = useCallback(
    async (nzbFileId: string): Promise<DownloadJob | null> => {
      const token = getToken();
      if (!token) return null;

      const res = await createDownloadJob(nzbFileId, token);
      if (res.ok && res.data?.job) {
        setJobs((prev) => [...prev.filter((j) => j.id !== res.data.job.id), res.data.job]);
        return res.data.job;
      }
      return null;
    },
    []
  );

  // ── Cancel a job ─────────────────────────────────────────
  const cancelJob = useCallback(
    async (jobId: string) => {
      const token = getToken();
      if (!token) return;

      await deleteDownloadJob(jobId, token);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    },
    []
  );

  // ── Get job for a specific NZB file ──────────────────────
  const getJobForFile = useCallback(
    (nzbFileId: string) => jobs.find((j) => j.nzbFileId === nzbFileId),
    [jobs]
  );

  // ── Check NZB availability for a TMDB movie ──────────────
  const checkAvailability = useCallback(
    async (tmdbId: number): Promise<NzbFileInfo[]> => {
      const token = getToken();
      if (!token) return [];

      const res = await getNzbMovieByTmdb(tmdbId, token);
      if (res.ok && res.data?.movie?.nzbFiles) {
        return res.data.movie.nzbFiles;
      }
      return [];
    },
    []
  );

  // ── Get presigned download link (original file) ───────────
  const getLink = useCallback(
    async (nzbFileId: string): Promise<string | null> => {
      const token = getToken();
      if (!token) return null;

      const res = await getDownloadLink(nzbFileId, token);
      if (res.ok && res.data?.url) {
        return res.data.url;
      }
      return null;
    },
    []
  );

  // ── Get presigned stream link (browser-compatible MP4) ───
  const getStreamUrl = useCallback(
    async (nzbFileId: string): Promise<string | null> => {
      const token = getToken();
      if (!token) return null;

      const res = await getStreamLinkApi(nzbFileId, token);
      if (res.ok && res.data?.url) {
        return res.data.url;
      }
      return null;
    },
    []
  );

  const activeCount = jobs.filter(
    (j) => j.status !== "completed" && j.status !== "failed"
  ).length;

  const completedJobs = jobs.filter((j) => j.status === "completed");

  return (
    <DownloadContext.Provider
      value={{
        jobs,
        startDownload,
        cancelJob,
        getJobForFile,
        checkAvailability,
        getLink,
        getStreamUrl,
        activeCount,
        completedJobs,
        isLoading,
        refresh: fetchJobs,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloads(): DownloadContextValue {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error("useDownloads must be used within a DownloadProvider");
  }
  return context;
}
