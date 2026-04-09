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
 *   3. User A assigns Matrix via a direct API call.
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
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ── 1. Register both users (parallel — independent contexts) ─────
      const identityA = generateE2EUserData();
      const identityB = generateE2EUserData();

      const [userA, userB] = await Promise.all([
        registerE2EUser(pageA, identityA),
        registerE2EUser(pageB, identityB),
      ]);

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
      await pageA.goto("/downloads");
      const reviewSectionA = pageA.locator("section", {
        hasText: "Zuordnung erforderlich",
      });
      await expect(reviewSectionA).toBeVisible();

      // Assign Matrix (tmdbId 603) to User A's job via direct API call.
      // This atomically flips ALL needs_review jobs on the shared NzbFile.
      const assignResult = await assignMovieDirect({
        jobId: uploadA.jobId,
        tmdbId: 603,
        token: userA.token,
      });
      // Both User A's and User B's jobs should have been flipped atomically.
      expect(assignResult.flippedCount).toBe(2);

      // Reload to pick up the state change.
      await pageA.reload();

      // User A should no longer see "Zuordnung erforderlich".
      await expect(reviewSectionA).not.toBeVisible();

      // User A should see "Aktive Downloads" with their job.
      const activeSectionA = pageA.locator("section", {
        hasText: "Aktive Downloads",
      });
      await expect(activeSectionA).toBeVisible();

      // ── 4. User B: verify auto-flip (no assign action performed) ─────
      await pageB.goto("/downloads");

      // User B should NOT see "Zuordnung erforderlich".
      await expect(
        pageB.locator("section", { hasText: "Zuordnung erforderlich" }),
      ).not.toBeVisible();

      // User B should see "Aktive Downloads".
      await expect(
        pageB.locator("section", { hasText: "Aktive Downloads" }),
      ).toBeVisible();

      // ── 5. Force-complete both jobs ──────────────────────────────────
      await forceCompleteJob(uploadA.jobId);
      await forceCompleteJob(uploadB.jobId);

      // ── 6. Both users see "Bereit" section ───────────────────────────
      await pageA.reload();
      await expect(
        pageA.locator("section", { hasText: "Bereit" }),
      ).toBeVisible();

      await pageB.reload();
      await expect(
        pageB.locator("section", { hasText: "Bereit" }),
      ).toBeVisible();

      // ── 7. Both users see the movie in their library ─────────────────
      await pageA.goto("/bibliothek");
      await expect(
        pageA.getByRole("heading", { name: /Matrix/i }),
      ).toBeVisible();

      await pageB.goto("/bibliothek");
      await expect(
        pageB.getByRole("heading", { name: /Matrix/i }),
      ).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
