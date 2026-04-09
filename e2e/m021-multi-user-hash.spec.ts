import { test, expect } from "@playwright/test";
import { generateE2EUserData, registerE2EUser } from "./helpers/auth";
import { buildUnmatchableNzbContent, makeUnmatchableTitle, uploadNzbDirect } from "./helpers/nzb-upload";
import { forceCompleteJob, assignMovieDirect } from "./helpers/test-api";
import { cleanupAllE2EData } from "./helpers/db-cleanup";

/**
 * M021/S02: Multi-user hash-sharing flow (R006).
 *
 * When two users upload the same NZB file (identical content → identical
 * SHA256 hash), the backend deduplicates on the NzbFile level: both
 * DownloadJobs point at the same NzbFile row. When one user manually
 * assigns a TMDB movie via POST /downloads/jobs/:id/assign-movie, the
 * backend atomically flips ALL needs_review jobs on that NzbFile to
 * queued — including the other user's job.
 *
 * This spec validates the cross-user flip in two separate browser
 * contexts:
 *   1. User A and User B each register in their own BrowserContext.
 *   2. Both upload the same NZB content (same hash).
 *   3. User A assigns Matrix via a direct API call (bypassing the UI
 *      dialog to avoid the non-user-scoped job list complication).
 *   4. User A's /downloads page shows "Aktive Downloads" (queued).
 *   5. User B reloads /downloads and sees their job ALSO in "Aktive
 *      Downloads" — without ever calling assign themselves.
 *   6. Force-complete both jobs, both users see the movie in their
 *      library.
 */

test.describe("M021 multi-user hash-sharing flow", () => {
  test.afterEach(async () => {
    await cleanupAllE2EData();
  });

  test("User A assigns → User B's job auto-flips to queued", async ({ browser }) => {
    // ── Setup: two isolated browser contexts ─────────────────────────
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ── 1. Register both users ───────────────────────────────────────
      const identityA = generateE2EUserData();
      const identityB = generateE2EUserData();

      const userA = await registerE2EUser(pageA, identityA);
      const userB = await registerE2EUser(pageB, identityB);

      // ── 2. Both upload the SAME NZB (identical content = same hash) ──
      const sharedTitle = makeUnmatchableTitle();
      const sharedNzbContent = buildUnmatchableNzbContent(sharedTitle);

      const uploadA = await uploadNzbDirect({
        nzbContent: sharedNzbContent,
        title: sharedTitle,
        token: userA.token,
      });
      expect(uploadA.needsReview).toBe(true);
      expect(uploadA.status).toBe("needs_review");

      const uploadB = await uploadNzbDirect({
        nzbContent: sharedNzbContent,
        title: sharedTitle,
        token: userB.token,
      });
      expect(uploadB.needsReview).toBe(true);
      expect(uploadB.status).toBe("needs_review");

      // Both uploads must reference the same NzbFile (hash dedup).
      expect(uploadB.nzbFileId).toBe(uploadA.nzbFileId);
      expect(uploadB.hash).toBe(uploadA.hash);
      // But they must be separate DownloadJobs.
      expect(uploadB.jobId).not.toBe(uploadA.jobId);

      // ── 3. User A: verify needs_review, then assign via API ──────────
      // We navigate to /downloads first to confirm the UI shows the
      // review section, then assign via a direct API call. We use the
      // API call (not the dialog) because the downloads endpoint is not
      // user-scoped — User A would see User B's job too, making button
      // targeting unreliable. The assign endpoint itself has an ownership
      // check (job.userId === caller.userId), so calling it with User A's
      // token + User A's jobId is the correct and deterministic path.
      await pageA.goto("/downloads");
      const reviewSectionA = pageA.locator("section", {
        hasText: "Zuordnung erforderlich",
      });
      await expect(reviewSectionA).toBeVisible({ timeout: 15000 });

      // Assign Matrix (tmdbId 603) to User A's job via direct API call.
      // This atomically flips ALL needs_review jobs on the shared NzbFile
      // — including User B's job.
      const assignResult = await assignMovieDirect({
        jobId: uploadA.jobId,
        tmdbId: 603,
        token: userA.token,
      });
      expect(assignResult.ok).toBe(true);

      // Reload to pick up the state change.
      await pageA.reload();

      // User A should no longer see "Zuordnung erforderlich".
      await expect(reviewSectionA).not.toBeVisible({ timeout: 10000 });

      // User A should see "Aktive Downloads" with their job.
      const activeSectionA = pageA.locator("section", {
        hasText: "Aktive Downloads",
      });
      await expect(activeSectionA).toBeVisible({ timeout: 10000 });

      // ── 4. User B: verify auto-flip (no assign action performed) ─────
      await pageB.goto("/downloads");

      // User B should NOT see "Zuordnung erforderlich".
      const reviewSectionB = pageB.locator("section", {
        hasText: "Zuordnung erforderlich",
      });
      await expect(reviewSectionB).not.toBeVisible({ timeout: 10000 });

      // User B should see "Aktive Downloads".
      const activeSectionB = pageB.locator("section", {
        hasText: "Aktive Downloads",
      });
      await expect(activeSectionB).toBeVisible({ timeout: 10000 });

      // ── 5. Force-complete both jobs ──────────────────────────────────
      await forceCompleteJob(uploadA.jobId);
      await forceCompleteJob(uploadB.jobId);

      // ── 6. Both users see "Bereit" section ───────────────────────────
      await pageA.reload();
      await expect(
        pageA.locator("section", { hasText: "Bereit" }),
      ).toBeVisible({ timeout: 10000 });

      await pageB.reload();
      await expect(
        pageB.locator("section", { hasText: "Bereit" }),
      ).toBeVisible({ timeout: 10000 });

      // ── 7. Both users see the movie in their library ─────────────────
      await pageA.goto("/bibliothek");
      await expect(
        pageA.getByRole("heading", { name: /Matrix/i }),
      ).toBeVisible({ timeout: 15000 });

      await pageB.goto("/bibliothek");
      await expect(
        pageB.getByRole("heading", { name: /Matrix/i }),
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
