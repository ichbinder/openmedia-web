/**
 * Thin client for the openmedia-api test-only endpoints (see
 * server/src/routes/test.ts in openmedia-api). These endpoints are only
 * reachable when the backend runs with NODE_ENV=test AND
 * ENABLE_TEST_ENDPOINTS=1 — which is what playwright.config.ts sets on
 * the backend webServer.
 */

const BACKEND_URL = "http://localhost:4000";

export interface ForceCompleteResponse {
  ok: true;
  jobId: string;
  nzbFileId: string;
  s3Key: string;
  s3StreamKey: string;
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
