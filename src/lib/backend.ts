import type { EpisodeCode } from "./next-episode";
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

export interface EpisodeRef {
  id: string;
  season: number;
  episode: number;
  titleDe: string | null;
  show: {
    tmdbId: number;
    titleDe: string;
    titleEn: string;
    year: number | null;
    posterPath: string | null;
  };
}

export interface DownloadJob {
  id: string;
  // M021: 'needs_review' (waiting for manual TMDB assignment) and 'expired'
  // (review window elapsed, terminal) added in S01/S02.
  status:
    | "needs_review"
    | "queued"
    | "provisioning"
    | "downloading"
    | "uploading"
    | "completed"
    | "failed"
    | "expired";
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  // M021/S01: review-flow timestamps. null when status is not needs_review.
  reviewExpiresAt?: string | null;
  tmdbRetryCount?: number;
  tmdbRetryAfter?: string | null;
  nzbFileId: string;
  nzbFile: {
    id: string;
    hash: string;
    originalFilename?: string;
    resolution: string | null;
    qualityTier: string | null;
    fileExtension: string | null;
    s3Key: string | null;
    // M021/S01: nullable. needs_review NzbFiles have no movie linked yet.
    movie: {
      id: string;
      tmdbId: number;
      titleDe: string;
      titleEn: string;
      posterPath: string | null;
      year: number | null;
    } | null;
    episode: EpisodeRef | null;
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

/**
 * M021/S02: link a needs_review job to a TMDB movie.
 *
 * Reuses or creates an NzbMovie on the backend, links the NzbFile, and flips
 * all sibling needs_review jobs on the same hash to queued in one transaction.
 * Provisioning is triggered server-side after the response.
 *
 * Returns the linked movie plus how many jobs were flipped (>1 if multiple
 * users uploaded the same hash) and `alreadyAssigned: true` when another path
 * (concurrent assign or background retry) had already linked the file.
 */
export interface AssignMovieResponse {
  movie: {
    id: string;
    tmdbId: number;
    imdbId: string | null;
    titleDe: string;
    titleEn: string;
    year: number | null;
    posterPath: string | null;
  };
  flippedCount: number;
  alreadyAssigned: boolean;
}

export async function assignMovieToJob(jobId: string, tmdbId: number, token: string) {
  return backendFetch<AssignMovieResponse>(`/downloads/jobs/${jobId}/assign-movie`, {
    method: "POST",
    body: JSON.stringify({ tmdbId }),
    token,
  });
}

export async function deleteDownloadJob(jobId: string, token: string) {
  return backendFetch(`/downloads/jobs/${jobId}`, { method: "DELETE", token });
}

// ── NZB Files / Movies ───────────────────────────────────────

export interface NzbFileInfo {
  id: string;
  hash: string;
  resolution: string | null;
  qualityTier: string | null;
  s3Key: string | null;
  s3StreamKey: string | null;
  fileExtension: string | null;
  downloadedAt: string | null;
  status: "ok" | "broken" | "untested" | "expired";
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

export interface EpisodeRequestView {
  season: number;
  episode: number;
  status: "searching" | "waiting" | "downloading" | "done" | "expired";
  waitReason: "no_german" | "budget" | "indexer_error" | null;
}

export interface NzbShowInfo {
  id: string;
  tmdbId: number;
  titleDe: string;
  titleEn: string;
  year: number | null;
  posterPath: string | null;
  episodes: {
    id: string;
    season: number;
    episode: number;
    titleDe: string | null;
    airDate: string | null;
    nzbFiles: (NzbFileInfo & {
      fileSize: string;
      originalFilename: string;
      duration: number | null;
    })[];
  }[];
}

export async function getNzbShowByTmdb(tmdbId: number, token: string) {
  return backendFetch<{ show: NzbShowInfo; myRequests: EpisodeRequestView[]; myLibrary: EpisodeCode[] }>(`/nzb/shows/by-tmdb/${tmdbId}`, { token });
}

export async function requestEpisodes(
  body: { tmdbId: number; season: number; episode?: number; guid?: string },
  token: string
) {
  return backendFetch<{
    requests?: EpisodeRequestView[];
    error?: string;
    reason?: string;
  }>("/series/requests", { method: "POST", body: JSON.stringify(body), token });
}

export interface ReleaseCandidate {
  guid: string;
  title: string;
  qualityTier: string;
  sizeBytes: number;
  gbPerHour: number;
  inTargetBand: boolean;
  germanSubtitles: boolean;
  audioDescription: boolean;
  releaseType: string | null;
  languageSource: string;
}

export async function getReleaseCandidates(
  tmdbId: number,
  season: number,
  episode: number,
  token: string
) {
  return backendFetch<{ candidates: ReleaseCandidate[] }>(
    `/series/candidates?tmdbId=${tmdbId}&season=${season}&episode=${episode}`,
    { token }
  );
}

// ── Movies ───────────────────────────────────────────────────

export interface MovieCandidate {
  key: string;
  nzbFileId: string | null;
  guid: string | null;
  title: string;
  group: "german" | "foreign" | "cam";
  german: boolean;
  state: "ready" | "available" | "indexer" | "broken";
  qualityTier: "2160p" | "1080p" | "720p" | "480p";
  releaseType: string | null;
  sizeBytes: number | null;
  audioLanguages: string[];
  germanSubtitles: boolean;
  audioDescription: boolean;
  inTargetBand: boolean;
  hashPrefix: string | null;
  brokenReason: string | null;
}

export async function getMovieCandidates(tmdbId: number, token: string) {
  return backendFetch<{ candidates: MovieCandidate[]; indexer: "ok" | "unavailable" }>(
    `/movies/candidates?tmdbId=${tmdbId}`,
    { token }
  );
}

export interface MovieRequestBody {
  tmdbId: number;
  key: string;
  confirmed?: boolean;
  manual?: boolean;
}

export async function requestMovieDownload(body: MovieRequestBody, token: string) {
  return backendFetch<{
    status: "ready" | "downloading";
    nzbFileId: string;
    reason?: string;
    group?: string;
    error?: string;
  }>("/movies/requests", { method: "POST", body: JSON.stringify(body), token });
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

export async function getStreamLink(nzbFileId: string, token: string, expires = "7d") {
  return backendFetch<DownloadLink>(`/nzb/files/${nzbFileId}/stream-link?expires=${expires}`, { token });
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
    } | null;
    episode: EpisodeRef | null;
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

// ── Search History ───────────────────────────────────────────

export interface SearchHistoryItem {
  id: string;
  movieId: number;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string;
  searchedAt: string;
}

export async function getSearchHistory(token: string, limit = 20) {
  const safeLimit = Number.isFinite(limit) ? Math.min(50, Math.max(1, Math.trunc(limit))) : 20;
  return backendFetch<{ items: SearchHistoryItem[] }>(`/search-history?limit=${safeLimit}`, { token });
}

export async function addToSearchHistory(
  token: string,
  item: { movieId: number; title: string; posterPath: string | null; voteAverage: number; releaseDate: string },
) {
  return backendFetch<{ item: SearchHistoryItem }>("/search-history", {
    method: "POST",
    body: JSON.stringify(item),
    token,
  });
}

export async function clearSearchHistory(token: string) {
  return backendFetch("/search-history", { method: "DELETE", token });
}
