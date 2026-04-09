/**
 * Thin client for the openmedia-api test-only endpoints (see
 * server/src/routes/test.ts in openmedia-api). These endpoints are only
 * reachable when the backend runs with NODE_ENV=test AND
 * ENABLE_TEST_ENDPOINTS=1 — which is what playwright.config.ts sets on
 * the backend webServer.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export interface ForceCompleteResponse {
  ok: true;
  jobId: string;
  nzbFileId: string;
  s3Key: string;
  s3StreamKey: string;
}

export interface AssignMovieResponse {
  ok: boolean;
  status: number;
  movie?: { titleEn?: string };
  flippedCount?: number;
  alreadyAssigned?: boolean;
}

/**
 * Assign a TMDB movie to a needs_review job via POST /downloads/jobs/:id/assign-movie.
 * This is the production endpoint (not test-only) — requires the job owner's token.
 * Used in the multi-user spec to make a deterministic assign call without relying
 * on the UI dialog (which shows all users' jobs due to the non-scoped GET /jobs endpoint).
 */
export async function assignMovieDirect(params: {
  jobId: string;
  tmdbId: number;
  token: string;
}): Promise<AssignMovieResponse> {
  const res = await fetch(`${BACKEND_URL}/downloads/jobs/${params.jobId}/assign-movie`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({ tmdbId: params.tmdbId }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    ok: res.ok,
    status: res.status,
    movie: body.movie as AssignMovieResponse["movie"],
    flippedCount: body.flippedCount as number | undefined,
    alreadyAssigned: body.alreadyAssigned as boolean | undefined,
  };
}

/**
 * Simulate a successful download callback for a job. After this call the
 * job will be in status=completed, the NzbFile will have fake S3 keys,
 * and the job's owner will have a UserLibrary entry pointing at the
 * NzbFile. The spec can then assert on the frontend's "Bereit" section.
 *
 * Throws on non-2xx responses to surface guard failures (e.g. forgetting
 * to set ENABLE_TEST_ENDPOINTS) instead of silently swallowing them.
 */
export async function forceCompleteJob(jobId: string): Promise<ForceCompleteResponse> {
  const res = await fetch(`${BACKEND_URL}/test/jobs/${jobId}/force-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      `[e2e-test-api] force-complete ${res.status}: ${JSON.stringify(body)}`,
    );
  }

  return body as unknown as ForceCompleteResponse;
}
