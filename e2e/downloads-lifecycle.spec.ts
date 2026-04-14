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
 * M023/S03/T01: Download job lifecycle, status transitions, and force-complete E2E tests.
 *
 * Comprehensive coverage of the download job state machine:
 *   1. Full lifecycle: queued → provisioning → downloading → uploading → completed
 *   2. Invalid status transitions (skip steps → 422)
 *   3. Same-status update with progress field (200)
 *   4. Same-status update without fields (422)
 *   5. DELETE protection for active jobs (422) and queued jobs (200)
 *   6. Job list with status filter
 *   7. Download link 422 for non-completed jobs
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
      name: `E2E DL ${id.slice(-6)}`,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`[dl-lifecycle] Register failed ${res.status}: ${JSON.stringify(body)}`);
  }

  const data = (await res.json()) as {
    user: { id: string; email: string };
    token: string;
  };
  return { userId: data.user.id, email: data.user.email, token: data.token };
}

/**
 * Upload an unmatchable NZB and return the job + nzbFile info.
 * The job will be in "needs_review" status (unmatchable title).
 * We then assign a movie to get it to "queued" for lifecycle tests.
 */
async function createQueuedJob(token: string) {
  const title = makeUnmatchableTitle();
  const nzbContent = buildUnmatchableNzbContent(title);
  const upload = await uploadNzbDirect({ nzbContent, title, token });

  // The upload creates a needs_review job — assign Matrix to flip it to queued
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
    throw new Error(`[dl-lifecycle] Assign failed ${assignRes.status}: ${JSON.stringify(body)}`);
  }

  // Verify it's now queued — poll with retries in case of async transitions
  let attempts = 0;
  let jobData: { job: { status: string; id: string; nzbFileId: string } };
  do {
    const getRes = await fetch(`${BACKEND_URL}/downloads/jobs/${upload.jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    jobData = (await getRes.json()) as { job: { status: string; id: string; nzbFileId: string } };
    if (jobData.job.status === "queued") break;
    if (++attempts >= 5) {
      throw new Error(`[dl-lifecycle] Job did not transition to queued (got: ${jobData.job.status})`);
    }
    await new Promise((r) => setTimeout(r, 500));
  } while (true);

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

/** Authenticated DELETE of a download job. */
async function deleteJob(jobId: string, token: string) {
  const res = await fetch(`${BACKEND_URL}/downloads/jobs/${jobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
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

test.describe("Download job lifecycle", () => {
  test.afterEach(async () => {
    await cleanupAllE2EData();
  });

  // ── 1. Full lifecycle ──────────────────────────────────────────────────

  test("full lifecycle: queued → provisioning → downloading → uploading → force-complete → completed", async () => {
    const { token, userId } = await registerTestUser();
    const { jobId, nzbFileId } = await createQueuedJob(token);

    // Verify starting status
    expect(["queued", "needs_review"]).toContain(
      (await (await fetch(`${BACKEND_URL}/downloads/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })).json()).job.status,
    );

    // queued → provisioning
    let res = await patchJobStatus(jobId, "provisioning", token);
    expect(res.status).toBe(200);
    let body = (await res.json()) as { job: { status: string; progress?: number } };
    expect(body.job.status).toBe("provisioning");

    // provisioning → downloading
    res = await patchJobStatus(jobId, "downloading", token, { progress: 25 });
    expect(res.status).toBe(200);
    body = (await res.json()) as { job: { status: string; progress?: number } };
    expect(body.job.status).toBe("downloading");
    expect(body.job.progress).toBe(25);

    // downloading → uploading
    res = await patchJobStatus(jobId, "uploading", token, { progress: 75 });
    expect(res.status).toBe(200);
    body = (await res.json()) as { job: { status: string; progress?: number } };
    expect(body.job.status).toBe("uploading");
    expect(body.job.progress).toBe(75);

    // Force-complete via test endpoint
    const completion = await forceCompleteJob(jobId);
    expect(completion.ok).toBe(true);
    expect(completion.s3Key).toBeTruthy();
    expect(completion.s3StreamKey).toBeTruthy();
    expect(completion.nzbFileId).toBe(nzbFileId);

    // Verify job is completed
    const getRes = await fetch(`${BACKEND_URL}/downloads/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const jobData = (await getRes.json()) as {
      job: {
        status: string;
        progress: number;
        nzbFile: { s3Key: string; s3StreamKey: string };
      };
    };
    expect(jobData.job.status).toBe("completed");
    expect(jobData.job.progress).toBe(100);
    expect(jobData.job.nzbFile.s3Key).toBeTruthy();
    expect(jobData.job.nzbFile.s3StreamKey).toBeTruthy();

    // Verify UserLibrary auto-upserted (force-complete adds to library)
    const libRes = await fetch(`${BACKEND_URL}/library`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(libRes.status).toBe(200);
    const libData = (await libRes.json()) as { items: { nzbFile: { id: string } }[] };
    expect(libData.items).toHaveLength(1);
    expect(libData.items[0].nzbFile.id).toBe(nzbFileId);
  });

  // ── 2. Invalid transitions ─────────────────────────────────────────────

  test("invalid transition: queued → completed skips steps → 422 with allowedTransitions", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    const res = await patchJobStatus(jobId, "completed", token);
    expect(res.status).toBe(422);

    const body = (await res.json()) as {
      error: string;
      currentStatus: string;
      allowedTransitions: string[];
    };
    expect(body.currentStatus).toBe("queued");
    expect(body.allowedTransitions).toEqual(
      expect.arrayContaining(["provisioning", "failed"]),
    );
  });

  test("invalid transition: queued → uploading skips steps → 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    const res = await patchJobStatus(jobId, "uploading", token);
    expect(res.status).toBe(422);
  });

  test("invalid transition: provisioning → completed → 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // First advance to provisioning
    await patchJobStatus(jobId, "provisioning", token);

    const res = await patchJobStatus(jobId, "completed", token);
    expect(res.status).toBe(422);
  });

  // ── 3. Same-status update with progress field ──────────────────────────

  test("same-status update with progress field returns 200", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // Patch queued → queued with a progress field
    const res = await patchJobStatus(jobId, "queued", token, { progress: 10 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { job: { status: string; progress: number } };
    expect(body.job.status).toBe("queued");
    expect(body.job.progress).toBe(10);
  });

  // ── 4. Same-status update without fields ───────────────────────────────

  test("same-status update without any fields returns 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // Patch queued → queued without any additional fields
    const res = await patchJobStatus(jobId, "queued", token);
    expect(res.status).toBe(422);

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Keine");
  });

  // ── 5. DELETE protection ───────────────────────────────────────────────

  test("DELETE active job (provisioning) returns 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // Advance to provisioning
    await patchJobStatus(jobId, "provisioning", token);

    // Try to delete — should be blocked
    const res = await deleteJob(jobId, token);
    expect(res.status).toBe(422);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  test("DELETE active job (downloading) returns 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // Advance to downloading
    await patchJobStatus(jobId, "provisioning", token);
    await patchJobStatus(jobId, "downloading", token);

    // Try to delete — should be blocked
    const res = await deleteJob(jobId, token);
    expect(res.status).toBe(422);
  });

  test("DELETE active job (uploading) returns 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // Advance to uploading
    await patchJobStatus(jobId, "provisioning", token);
    await patchJobStatus(jobId, "downloading", token);
    await patchJobStatus(jobId, "uploading", token);

    // Try to delete — should be blocked
    const res = await deleteJob(jobId, token);
    expect(res.status).toBe(422);
  });

  test("DELETE queued job returns 200", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    // Job is in queued status — delete should succeed
    const res = await deleteJob(jobId, token);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    // Verify job is gone
    const getRes = await fetch(`${BACKEND_URL}/downloads/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(404);
  });

  // ── 6. Job list with status filter ─────────────────────────────────────

  test("job list with status filter returns only matching jobs", async () => {
    const { token } = await registerTestUser();

    // Create two jobs
    const job1 = await createQueuedJob(token);
    const job2 = await createQueuedJob(token);

    // Force-complete job1
    await forceCompleteJob(job1.jobId);

    // GET /downloads/jobs?status=completed should return only job1
    const completedRes = await fetch(`${BACKEND_URL}/downloads/jobs?status=completed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(completedRes.status).toBe(200);
    const completedData = (await completedRes.json()) as { jobs: { id: string; status: string }[] };
    expect(completedData.jobs.length).toBeGreaterThanOrEqual(1);
    expect(completedData.jobs.every((j) => j.status === "completed")).toBe(true);

    // Verify job1 is in the completed list
    const completedIds = completedData.jobs.map((j) => j.id);
    expect(completedIds).toContain(job1.jobId);

    // GET /downloads/jobs?status=invalid returns 400
    const invalidRes = await fetch(`${BACKEND_URL}/downloads/jobs?status=invalid`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(invalidRes.status).toBe(400);
  });

  test("job list without filter returns all jobs", async () => {
    const { token } = await registerTestUser();

    const job1 = await createQueuedJob(token);
    const job2 = await createQueuedJob(token);

    // Force-complete one, leave one queued
    await forceCompleteJob(job1.jobId);

    const res = await fetch(`${BACKEND_URL}/downloads/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { jobs: { id: string }[] };
    const ids = data.jobs.map((j) => j.id);
    expect(ids).toContain(job1.jobId);
    expect(ids).toContain(job2.jobId);
  });

  // ── 7. Download link 422 for non-completed jobs ────────────────────────

  test("download link on queued job returns 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    const res = await getDownloadLink(jobId, token);
    expect(res.status).toBe(422);

    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("abgeschlossene");
  });

  test("download link on provisioning job returns 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    await patchJobStatus(jobId, "provisioning", token);

    const res = await getDownloadLink(jobId, token);
    expect(res.status).toBe(422);
  });

  test("download link on downloading job returns 422", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    await patchJobStatus(jobId, "provisioning", token);
    await patchJobStatus(jobId, "downloading", token);

    const res = await getDownloadLink(jobId, token);
    expect(res.status).toBe(422);
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  test("PATCH with invalid status returns 400", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    const res = await patchJobStatus(jobId, "nonexistent", token);
    expect(res.status).toBe(400);
  });

  test("PATCH on non-existent job returns 404", async () => {
    const { token } = await registerTestUser();

    const res = await patchJobStatus("nonexistent-job-id", "queued", token);
    expect(res.status).toBe(404);
  });

  test("progress validation: negative value returns 400", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    const res = await patchJobStatus(jobId, "queued", token, { progress: -1 });
    expect(res.status).toBe(400);
  });

  test("progress validation: value > 100 returns 400", async () => {
    const { token } = await registerTestUser();
    const { jobId } = await createQueuedJob(token);

    const res = await patchJobStatus(jobId, "queued", token, { progress: 101 });
    expect(res.status).toBe(400);
  });
});
