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
  /** Get presigned download URL for an NZB file */
  getLink: (nzbFileId: string) => Promise<string | null>;
  /** Number of active (non-terminal) jobs */
  activeCount: number;
  /** Jobs that are completed (ready for download) */
  completedJobs: DownloadJob[];
  /** Loading state */
  isLoading: boolean;
  /** Refresh jobs from API */
  refresh: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

// ── Poll configuration ───────────────────────────────────────
/** Initial poll interval when downloads are active */
const POLL_INTERVAL_INITIAL_MS = 5_000;
/** Maximum poll interval after backoff */
const POLL_INTERVAL_MAX_MS = 60_000;
/** Backoff multiplier per unchanged poll cycle */
const POLL_BACKOFF_FACTOR = 1.5;
export function DownloadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef(POLL_INTERVAL_INITIAL_MS);
  const lastJobsHashRef = useRef("");

  // ── Fetch all jobs from API ──────────────────────────────
  const fetchJobs = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const res = await getDownloadJobs(token);
    if (res.ok && res.data?.jobs) {
      setJobs(res.data.jobs);
    }
  }, []);

  // ── Load jobs on login ───────────────────────────────────
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetchJobs().finally(() => setIsLoading(false));
    } else {
      setJobs([]);
    }
  }, [user, fetchJobs]);

  // ── Client-side stale detection ──────────────────────────
  // Mark jobs as "probably stuck" on the client if they haven't
  // progressed in CLIENT_STALE_HOURS. These stay in their API status
  // but the UI can show a warning.
  const activeJobs = jobs.filter(
    (j) => j.status !== "completed" && j.status !== "failed"
  );
  const hasActive = activeJobs.length > 0;

  // ── Adaptive polling with exponential backoff ────────────
  // Polls fast when downloads are progressing, slows down
  // when nothing changes (e.g. stuck provisioning).
  useEffect(() => {
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
        await fetchJobs();

        // Compute a simple hash of active job statuses + progress
        // to detect whether anything changed
        const currentHash = activeJobs
          .map((j) => `${j.id}:${j.status}:${j.progress}`)
          .sort()
          .join("|");

        if (currentHash === lastJobsHashRef.current) {
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
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [hasActive, user, fetchJobs, activeJobs]);

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

  // ── Get presigned download link ──────────────────────────
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
