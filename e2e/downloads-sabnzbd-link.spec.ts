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
 * M023/S03/T02: SABnzbd endpoints, download link edge cases, and failed job E2E tests.
 *
 * Coverage:
 *   1. SABnzbd status — graceful response when not configured
 *   2. SABnzbd config — returns { configured: false } when not set up
 *   3. Download link 502/503 for completed job without real S3
 *   4. Failed job flow — transition to failed with error message
 *   5. Download link 422 for non-completed (failed) jobs
 *
 * All tests hit the backend API directly (no browser UI) at localhost:4000.
 * Each test is self-contained and creates its own user + job data.
 * Cleanup via afterEach → POST /test/cleanup.
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
      name: `E2E SAB ${id.slice(-6)}`,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`[sab-link] Register failed ${res.status}: ${JSON.stringify(body)}`);
  }

  const data = (await res.json()) as {
    user: { id: string; email: string };
    token: string;
  };
  return { userId: data.user.id, email: data.user.email, token: data.token };
}

/** Upload an unmatchable NZB, assign Matrix, and return a queued job. */
async function createQueuedJob(token: string) {
  const title = makeUnmatchableTitle();
  const nzbContent = buildUnmatchableNzbContent(title);
  const upload = await uploadNzbDirect({ nzbContent, title, token });

  const assignRes = await fetch(`${BACKEND_URL}/downloads/jobs/${upload.jobId}/assign-movie`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tmdbId: 603 }), // Matrix
  });

  if (!assignRes.ok) {
    const body = await assignRes.json().catch(() => ({}));
    throw new Error(`[sab-link] Assign failed ${assignRes.status}: ${JSON.stringify(body)}`);
  }

  const getRes = await fetch(`${BACKEND_URL}/downloads/jobs/${upload.jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const jobData = (await getRes.json()) as { job: { status: string; id: string; nzbFileId: string } };

  return {
    jobId: jobData.job.id,
    nzbFileId: upload.nzbFileId,
    status: jobData.job.status,
  };
}

/** Authenticated PATCH to update job status. */
async function patchJobStatus(
  jobId: string,
  status: string,
  token: string,
  extra: Record<string, unknown> = {},
) {
  const res = await fetch(`${BACKEND_URL}/downloads/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status, ...extra }),
  });
  return res;
}

/** Authenticated GET for download link. */
async function getDownloadLink(jobId: string, token: string) {
  const res = await fetch(`${BACKEND_URL}/downloads/jobs/${jobId}/link`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────────

test.describe("SABnzbd endpoints and download link edge cases", () => {
  test.afterEach(async () => {
    await cleanupAllE2EData();
  });

  // ── 1. SABnzbd status (no SABnzbd configured) ─────────────────────────

  test("GET /downloads/sabnzbd/status returns 200 with connected=false when not configured", async () => {
    const { token } = await registerTestUser();

    const res = await fetch(`${BACKEND_URL}/downloads/sabnzbd/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      connected: boolean;
      error?: string;
    };
    expect(body.connected).toBe(false);
    // Should have an error message explaining why it's not connected
    expect(body.error).toBeTruthy();
  });

  // ── 2. SABnzbd config (no SABnzbd configured) ─────────────────────────

  test("GET /downloads/sabnzbd/config returns 200 with configured=false", async () => {
    const { token } = await registerTestUser();

    const res = await fetch(`${BACKEND_URL}/downloads/sabnzbd/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      configured: boolean;
      category: string | null;
    };
    expect(body.configured).toBe(false);
    expect(body.category).toBeNull();
  });

  // ── 3. Download link for force-completed job (S3 availability varies) ──

  test("GET /downloads/jobs/:id/link respects S3 availability", async () => {
    const { token } = await registerTestUser();
    const { jobId, nzbFileId } = await createQueuedJob(token);

    // Force-complete — sets fake S3 keys
    const completion = await forceCompleteJob(jobId);
    expect(completion.ok).toBe(true);
    expect(completion.s3Key).toBeTruthy();

    // GET link — behavior depends on S3 availability:
    // - S3 reachable & file exists  → 200
    // - S3 reachable but file missing → 410 (FILE_GONE)
    // - S3 unreachable (transient)   → 502
    // - S3 not configured            → 503
    // We assert that a valid JSON response is returned with a truthful status code.
    const res = await getDownloadLink(jobId, token);
    expect([200, 410, 502, 503]).toContain(res.status);

    const body = (await res.json()) as { error?: string; code?: string; url?: string };
    if (res.status === 200) {
      expect(body.url).toBeTruthy();
    } else if (res.status === 410) {
      expect(body.code).toBe("FILE_GONE");
    } else {
      expect(body.error).toBeTruthy();
    }
  });

  // ── 4. Failed job flow ────────────────────────────────────────────────

  test("queued → failed transition sets error message and completedAt", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    const errorMessage = "E2E test: connection to news server lost";
    const res = await patchJobStatus(jobId, "failed", token, {
      error: errorMessage,
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      job: { status: string; error?: string; completedAt?: string };
    };
    expect(body.job.status).toBe("failed");
    expect(body.job.error).toBe(errorMessage);
    expect(body.job.completedAt).toBeTruthy();

    // Verify persisted via GET
    const getRes = await fetch(`${BACKEND_URL}/downloads/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const jobData = (await getRes.json()) as {
      job: { status: string; error?: string; completedAt?: string };
    };
    expect(jobData.job.status).toBe("failed");
    expect(jobData.job.error).toContain("E2E test");
    expect(jobData.job.completedAt).toBeTruthy();
  });

  test("provisioning → failed transition works", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // queued → provisioning
    await patchJobStatus(jobId, "provisioning", token);

    // provisioning → failed
    const res = await patchJobStatus(jobId, "failed", token, {
      error: "VPS provisioning failed",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { job: { status: string; error: string } };
    expect(body.job.status).toBe("failed");
    expect(body.job.error).toBe("VPS provisioning failed");
  });

  test("downloading → failed transition works", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // queued → provisioning → downloading
    await patchJobStatus(jobId, "provisioning", token);
    await patchJobStatus(jobId, "downloading", token);

    // downloading → failed
    const res = await patchJobStatus(jobId, "failed", token, {
      error: "Download interrupted",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { job: { status: string } };
    expect(body.job.status).toBe("failed");
  });

  test("uploading → failed transition works", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // queued → provisioning → downloading → uploading
    await patchJobStatus(jobId, "provisioning", token);
    await patchJobStatus(jobId, "downloading", token);
    await patchJobStatus(jobId, "uploading", token);

    // uploading → failed
    const res = await patchJobStatus(jobId, "failed", token, {
      error: "S3 upload rejected",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { job: { status: string; error: string } };
    expect(body.job.status).toBe("failed");
    expect(body.job.error).toBe("S3 upload rejected");
  });

  // ── 5. Download link for failed job ────────────────────────────────────

  test("GET /downloads/jobs/:id/link returns 422 for failed job", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // Transition to failed
    await patchJobStatus(jobId, "failed", token, {
      error: "Failed for link test",
    });

    const res = await getDownloadLink(jobId, token);
    expect(res.status).toBe(422);

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("abgeschlossene");
  });

  // ── 6. Failed job is terminal (no transitions out) ─────────────────────

  test("failed job rejects further status transitions", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // Move to failed
    await patchJobStatus(jobId, "failed", token, { error: "Done" });

    // Try to transition out of failed — should be rejected
    const res = await patchJobStatus(jobId, "queued", token);
    expect(res.status).toBe(422);

    const body = (await res.json()) as {
      error: string;
      currentStatus: string;
      allowedTransitions: string[];
    };
    expect(body.currentStatus).toBe("failed");
    expect(body.allowedTransitions).toEqual([]);
  });

  // ── 7. Download link for non-existent job ──────────────────────────────

  test("GET /downloads/jobs/:id/link returns 404 for non-existent job", async () => {
    const { token } = await registerTestUser();

    const res = await getDownloadLink("nonexistent-job-id", token);
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("nicht gefunden");
  });

  // ── 8. SABnzbd endpoints require auth ──────────────────────────────────

  test("GET /downloads/sabnzbd/status requires authentication", async () => {
    const res = await fetch(`${BACKEND_URL}/downloads/sabnzbd/status`);
    // Should return 401 since no auth token is provided
    expect(res.status).toBe(401);
  });

  test("GET /downloads/sabnzbd/config requires authentication", async () => {
    const res = await fetch(`${BACKEND_URL}/downloads/sabnzbd/config`);
    expect(res.status).toBe(401);
  });
});
