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

// ── Poll interval for active downloads ───────────────────────
const POLL_INTERVAL_MS = 5000;

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── Poll active jobs ─────────────────────────────────────
  const hasActive = jobs.some(
    (j) => j.status !== "completed" && j.status !== "failed"
  );

  useEffect(() => {
    if (!hasActive || !user) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasActive, user, fetchJobs]);

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
