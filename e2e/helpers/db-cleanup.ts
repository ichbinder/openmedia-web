import { Client } from "pg";

/**
 * Direct Postgres client for E2E test cleanup. Lets specs delete the
 * users + related rows they created without going through the frontend
 * or needing privileged backend endpoints.
 *
 * We use `pg` directly instead of importing Prisma from the backend
 * because:
 *  - The backend lives in a sibling repo — importing from it would
 *    couple the E2E suite to that repo's build.
 *  - Prisma's generated client is several MB — overkill for a few
 *    DELETEs.
 *  - Raw SQL lets us write cascading cleanups exactly matching our
 *    test user email prefix (`e2e-%@test.local`) without re-tracing
 *    Prisma's relation graph.
 *
 * Connection points at the db-test container on port 5433 — same
 * DATABASE_URL the backend uses.
 */

const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  "postgresql://cinescope_test:cinescope_test@localhost:5433/cinescope_test";

/**
 * Run a callback with a short-lived Postgres client. Always closes the
 * connection, even on error.
 */
async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Delete a single E2E test user by email. Manually deletes the user's
 * download_jobs first because DownloadJob.userId is a nullable String
 * without an `onDelete: Cascade` — deleting the user alone would leave
 * orphan jobs in the DB.
 *
 * UserLibrary and watchlist_items DO cascade via their user relations,
 * so they're handled by the final `DELETE FROM users` automatically.
 *
 * Leaves nzb_files alone because they may be shared with other users
 * (M021 hash-sharing) — the nzb_files cleanup is handled by the orphan
 * scan in cleanupOrphanNzbFiles.
 *
 * Safe to call on non-existent emails (no error, no-op).
 */
export async function cleanupTestUser(email: string): Promise<void> {
  await withClient(async (client) => {
    // Look up the user id so we can wipe their non-cascading jobs.
    const userRow = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email],
    );
    const userId = userRow.rows[0]?.id as string | undefined;

    if (userId) {
      // DownloadJob.userId is nullable and has no ON DELETE CASCADE —
      // wipe jobs before the user row to avoid leaving orphans.
      await client.query(`DELETE FROM download_jobs WHERE user_id = $1`, [userId]);
    }

    await client.query(`DELETE FROM users WHERE email = $1`, [email]);
  });
}

/**
 * Delete every user whose email starts with `e2e-` and ends with
 * `@test.local`. Use as a sweeping cleanup in afterAll hooks or a
 * pre-run hook to clear residue from crashed specs.
 *
 * The LIKE pattern is tight — it will not match real users because
 * real emails don't use the `.local` TLD in this project.
 *
 * Same orphan-safety caveat as cleanupTestUser: DownloadJob.userId has
 * no cascade, so we have to wipe jobs before the users themselves.
 */
export async function cleanupAllE2EUsers(): Promise<number> {
  return withClient(async (client) => {
    // Delete non-cascading download_jobs first, scoped to E2E users.
    await client.query(`
      DELETE FROM download_jobs
      WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE 'e2e-%@test.local'
      )
    `);
    const result = await client.query(
      `DELETE FROM users WHERE email LIKE 'e2e-%@test.local' RETURNING id`,
    );
    return result.rowCount ?? 0;
  });
}

/**
 * Delete any NzbFile rows that no longer have any download_jobs or
 * user_library entries pointing at them. Call after cleanupTestUser /
 * cleanupAllE2EUsers to collect the E2E-only NzbFiles that the user
 * cleanups orphaned.
 */
export async function cleanupOrphanNzbFiles(): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query(`
      DELETE FROM nzb_files
      WHERE id NOT IN (SELECT DISTINCT nzb_file_id FROM download_jobs)
        AND id NOT IN (SELECT DISTINCT nzb_file_id FROM user_library)
      RETURNING id
    `);
    return result.rowCount ?? 0;
  });
}

/**
 * Convenience: full cleanup suite in one call. Runs user + orphan cleanup
 * sequentially. Returns counts for logging.
 */
export async function cleanupAllE2EData(): Promise<{
  users: number;
  orphanFiles: number;
}> {
  const users = await cleanupAllE2EUsers();
  const orphanFiles = await cleanupOrphanNzbFiles();
  return { users, orphanFiles };
}
