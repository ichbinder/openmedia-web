import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import {
  buildUnmatchableNzbContent,
  makeUnmatchableTitle,
  uploadNzbDirect,
} from "./helpers/nzb-upload";
import { forceCompleteJob } from "./helpers/test-api";
import { cleanupAllE2EData } from "./helpers/db-cleanup";

/**
 * M023/S02/T01: Library endpoint E2E tests.
 *
 * Covers all 4 library route endpoints plus validation and user isolation.
 * All tests hit the backend API directly (no browser UI) since these are
 * API-level tests. Each test is self-contained and creates its own data.
 *
 * Endpoints tested:
 *   GET    /library           — list user's active library items
 *   POST   /library           — add a film to user's library
 *   DELETE /library/:nzbFileId — remove a film from user's library
 *   GET    /library/retention/:nzbFileId — active user count for a film
 *
 * Note on force-complete: the test endpoint auto-adds the file to the
 * job owner's library and sets fake S3 keys. Tests that need a file
 * with S3 key but NOT yet in the library use a two-user trick: user A
 * force-completes (gets S3 key + auto-library entry), then user B can
 * POST /library to add the same file. This avoids the issue where
 * DELETE /library clears the S3 key when no users remain.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Register a fresh E2E user directly via the auth API. Returns token + userId. */
async function registerTestUser(suffix?: string) {
  const id = suffix ?? `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const res = await fetch(`${BACKEND_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `e2e-${id}@test.local`,
      password: "e2e-test-password-1234",
      name: `E2E Library ${id.slice(-6)}`,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`[library-e2e] Register failed ${res.status}: ${JSON.stringify(body)}`);
  }

  const data = (await res.json()) as {
    user: { id: string; email: string };
    token: string;
  };
  return { userId: data.user.id, email: data.user.email, token: data.token };
}

/**
 * Upload an unmatchable NZB and force-complete it. This creates an NzbFile
 * with fake S3 keys and adds it to the job owner's library. Returns the
 * nzbFileId and the user's token.
 */
async function forceCompleteNzbFile(token: string) {
  const title = makeUnmatchableTitle();
  const nzbContent = buildUnmatchableNzbContent(title);
  const upload = await uploadNzbDirect({ nzbContent, title, token });
  const completion = await forceCompleteJob(upload.jobId);
  return { nzbFileId: completion.nzbFileId, jobId: upload.jobId };
}

/**
 * Create an NZB file WITHOUT an S3 key by uploading and leaving it in
 * needs_review state (no force-complete). Returns the nzbFileId.
 */
async function createFileWithoutS3Key(token: string): Promise<string> {
  const title = makeUnmatchableTitle();
  const nzbContent = buildUnmatchableNzbContent(title);
  const upload = await uploadNzbDirect({ nzbContent, title, token });
  return upload.nzbFileId;
}

/** Authenticated GET to /library. */
async function getLibrary(token: string) {
  const res = await fetch(`${BACKEND_URL}/library`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res;
}

/** Authenticated POST to /library. */
async function addToLibrary(token: string, nzbFileId: string) {
  const res = await fetch(`${BACKEND_URL}/library`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nzbFileId }),
  });
  return res;
}

/** Authenticated DELETE to /library/:nzbFileId. */
async function removeFromLibrary(token: string, nzbFileId: string) {
  const res = await fetch(`${BACKEND_URL}/library/${nzbFileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res;
}

/** GET /library/retention/:nzbFileId (requires auth). */
async function getRetention(nzbFileId: string, token: string) {
  const res = await fetch(`${BACKEND_URL}/library/retention/${nzbFileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────────

test.describe("Library API", () => {
  test.afterEach(async () => {
    await cleanupAllE2EData();
  });

  test("GET /library returns empty list for new user", async () => {
    const { token } = await registerTestUser();

    const res = await getLibrary(token);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  test("POST /library adds film (via force-complete) and GET shows it", async () => {
    const { token } = await registerTestUser();

    // Force-complete creates a file with S3 key and auto-adds to library
    const { nzbFileId } = await forceCompleteNzbFile(token);

    // Verify the auto-add worked: GET /library should show it
    const listRes = await getLibrary(token);
    expect(listRes.status).toBe(200);

    const listBody = (await listRes.json()) as {
      items: { nzbFile: { id: string } }[];
    };
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].nzbFile.id).toBe(nzbFileId);

    // Also verify POST /library returns the existing item (upsert idempotency)
    const addRes = await addToLibrary(token, nzbFileId);
    expect(addRes.status).toBe(200);

    const addBody = (await addRes.json()) as { item: { nzbFileId: string } };
    expect(addBody.item.nzbFileId).toBe(nzbFileId);
  });

  test("POST /library rejects without s3Key", async () => {
    const { token } = await registerTestUser();
    const nzbFileId = await createFileWithoutS3Key(token);

    const res = await addToLibrary(token, nzbFileId);
    expect(res.status).toBe(422);

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("heruntergeladen");
  });

  test("DELETE /library/:nzbFileId removes film", async () => {
    const { token } = await registerTestUser();

    // Force-complete creates a file with S3 key and auto-adds to library
    const { nzbFileId } = await forceCompleteNzbFile(token);

    // Verify it's in library first
    const listBefore = await getLibrary(token);
    const listBeforeBody = (await listBefore.json()) as { items: unknown[] };
    expect(listBeforeBody.items).toHaveLength(1);

    // Delete
    const delRes = await removeFromLibrary(token, nzbFileId);
    expect(delRes.status).toBe(200);

    const delBody = (await delRes.json()) as { removed: boolean };
    expect(delBody.removed).toBe(true);

    // Verify library is empty
    const listAfter = await getLibrary(token);
    const listAfterBody = (await listAfter.json()) as { items: unknown[] };
    expect(listAfterBody.items).toHaveLength(0);
  });

  test("GET /library/retention/:nzbFileId returns active user count", async () => {
    const { token } = await registerTestUser();

    // Force-complete creates a file with S3 key and auto-adds to library
    const { nzbFileId } = await forceCompleteNzbFile(token);

    // Check retention — should show 1 active user (the one who force-completed)
    const res = await getRetention(nzbFileId, token);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      activeUsers: number;
      inS3: boolean;
    };
    expect(body.activeUsers).toBe(1);
    expect(body.inS3).toBe(true);
  });

  test("Library is per-user isolated", async () => {
    const suffix = Date.now().toString();
    const userA = await registerTestUser(`a-${suffix}`);
    const userB = await registerTestUser(`b-${suffix}`);

    // User A: verify empty library
    const listA = await getLibrary(userA.token);
    const listABody = (await listA.json()) as { items: unknown[] };
    expect(listABody.items).toHaveLength(0);

    // User B: verify empty library
    const listB = await getLibrary(userB.token);
    const listBBody = (await listB.json()) as { items: unknown[] };
    expect(listBBody.items).toHaveLength(0);

    // User A force-completes a file (gets S3 key + auto-added to library)
    const { nzbFileId } = await forceCompleteNzbFile(userA.token);

    // User A's library has 1 item
    const listA2 = await getLibrary(userA.token);
    const listA2Body = (await listA2.json()) as { items: unknown[] };
    expect(listA2Body.items).toHaveLength(1);

    // User B's library is still empty (user isolation)
    const listB2 = await getLibrary(userB.token);
    const listB2Body = (await listB2.json()) as { items: unknown[] };
    expect(listB2Body.items).toHaveLength(0);

    // User B can also add the same file (since it has an S3 key)
    const addB = await addToLibrary(userB.token, nzbFileId);
    expect(addB.status).toBe(200);

    // Now user B also has 1 item
    const listB3 = await getLibrary(userB.token);
    const listB3Body = (await listB3.json()) as { items: unknown[] };
    expect(listB3Body.items).toHaveLength(1);

    // Retention should show 2 active users
    const ret = await getRetention(nzbFileId, userA.token);
    const retBody = (await ret.json()) as { activeUsers: number };
    expect(retBody.activeUsers).toBe(2);
  });
});
