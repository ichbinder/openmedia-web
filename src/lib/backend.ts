/**
 * Backend API client — all calls go through the Next.js proxy
 * /api/backend/* → openmedia-api
 */

const API_BASE = "/api/backend";

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function backendFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const { token, ...fetchOpts } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOpts,
    headers,
  });

  const data = await res.json().catch(() => null);

  return { ok: res.ok, status: res.status, data: data as T };
}

// ── Download Jobs ────────────────────────────────────────────

export interface DownloadJob {
  id: string;
  status: "queued" | "provisioning" | "downloading" | "uploading" | "completed" | "failed";
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  nzbFileId: string;
  nzbFile: {
    id: string;
    hash: string;
    resolution: string | null;
    fileExtension: string | null;
    s3Key: string | null;
    movie: {
      id: string;
      tmdbId: number;
      titleDe: string;
      titleEn: string;
      posterPath: string | null;
      year: number | null;
    };
  };
}

export async function createDownloadJob(nzbFileId: string, token: string) {
  return backendFetch<{ job: DownloadJob }>("/downloads/jobs", {
    method: "POST",
    body: JSON.stringify({ nzbFileId }),
    token,
  });
}

export async function getDownloadJob(jobId: string, token: string) {
  return backendFetch<{ job: DownloadJob }>(`/downloads/jobs/${jobId}`, { token });
}

export async function getDownloadJobs(token: string, status?: string) {
  const query = status ? `?status=${status}` : "";
  return backendFetch<{ jobs: DownloadJob[] }>(`/downloads/jobs${query}`, { token });
}

export async function deleteDownloadJob(jobId: string, token: string) {
  return backendFetch(`/downloads/jobs/${jobId}`, { method: "DELETE", token });
}

// ── NZB Files / Movies ───────────────────────────────────────

export interface NzbFileInfo {
  id: string;
  hash: string;
  resolution: string | null;
  s3Key: string | null;
  fileExtension: string | null;
  downloadedAt: string | null;
  status: "ok" | "broken" | "untested";
  brokenReason: string | null;
  failedAttempts: number;
}

export interface NzbMovieInfo {
  id: string;
  tmdbId: number;
  titleDe: string;
  titleEn: string;
  nzbFiles: NzbFileInfo[];
}

export async function getNzbMovieByTmdb(tmdbId: number, token: string) {
  return backendFetch<{ movie: NzbMovieInfo }>(`/nzb/movies/by-tmdb/${tmdbId}`, { token });
}

// ── Download Links ───────────────────────────────────────────

export interface DownloadLink {
  url: string;
  expiresIn: number;
  expiresAt: string;
}

export async function getDownloadLink(nzbFileId: string, token: string, expires = "7d") {
  return backendFetch<DownloadLink>(`/nzb/files/${nzbFileId}/download-link?expires=${expires}`, { token });
}

// ── Library ──────────────────────────────────────────────────

export interface LibraryItem {
  id: string;
  addedAt: string;
  removedAt: string | null;
  nzbFile: NzbFileInfo & {
    lastAccessedAt: string | null;
    scheduledDeletionAt: string | null;
    movie: {
      id: string;
      tmdbId: number;
      titleDe: string;
      titleEn: string;
      year: number | null;
      posterPath: string | null;
    };
  };
}

export async function getLibrary(token: string) {
  return backendFetch<{ items: LibraryItem[] }>("/library", { token });
}

export async function addToLibrary(nzbFileId: string, token: string) {
  return backendFetch("/library", {
    method: "POST",
    body: JSON.stringify({ nzbFileId }),
    token,
  });
}

export async function removeFromLibrary(nzbFileId: string, token: string) {
  return backendFetch<{ removed: boolean; s3Deleted: boolean; activeUsers?: number }>(
    `/library/${nzbFileId}`,
    { method: "DELETE", token }
  );
}

export async function getRetention(nzbFileId: string, token: string) {
  return backendFetch<{ activeUsers: number; inS3: boolean; scheduledDeletionAt: string | null }>(
    `/library/retention/${nzbFileId}`,
    { token }
  );
}
