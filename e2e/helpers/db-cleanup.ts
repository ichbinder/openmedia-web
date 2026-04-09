/**
 * E2E test cleanup — delegates to the backend's test-only
 * POST /test/cleanup endpoint instead of hitting the database directly.
 *
 * This keeps all schema knowledge inside the openmedia-api repo (via
 * Prisma) and eliminates the need for a raw `pg` devDependency in this
 * repo. The cleanup endpoint scopes its work to users whose email
 * matches `e2e-%@test.local`, deletes their non-cascading download_jobs,
 * the users themselves (which cascades user_library, watchlist_items,
 * api_tokens), and then sweeps orphan NzbFiles and NzbMovies.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export interface CleanupResult {
  ok: boolean;
  deleted: {
    users: number;
    jobs: number;
    nzbFiles: number;
    nzbMovies: number;
  };
}

/**
 * Call the backend's test cleanup endpoint. Removes all E2E test users
 * and their associated data. Safe to call repeatedly — returns zero
 * counts when nothing is left to clean.
 *
 * Throws on non-2xx so a misconfigured test environment (e.g. missing
 * ENABLE_TEST_ENDPOINTS) surfaces immediately instead of leaving stale
 * data in the database.
 */
export async function cleanupAllE2EData(): Promise<CleanupResult> {
  const res = await fetch(`${BACKEND_URL}/test/cleanup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      `[e2e-cleanup] ${res.status}: ${JSON.stringify(body)}`,
    );
  }

  return body as unknown as CleanupResult;
}
