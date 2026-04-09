import { test, expect } from "@playwright/test";
import { generateE2EUserData, registerE2EUser } from "./helpers/auth";
import { uploadFreshUnmatchableNzb } from "./helpers/nzb-upload";
import { forceCompleteJob } from "./helpers/test-api";
import { cleanupAllE2EData } from "./helpers/db-cleanup";

/**
 * M021/S01: Single-user needs_review flow.
 *
 * End-to-end coverage of the manual TMDB assignment path that M021 added:
 *
 *   1. User uploads an NZB whose title TMDB can't match (forced via a
 *      random "e2e-unmatchable-..." prefix that the TMDB mock returns no
 *      results for).
 *   2. The backend parks the job in status=needs_review.
 *   3. The downloads page surfaces a "Zuordnung erforderlich" section
 *      with the orphan job.
 *   4. The user clicks "Film zuordnen", the AssignMovieDialog opens,
 *      they search for Matrix, the TMDB mock returns tmdbId 603, they
 *      click the result.
 *   5. The backend flips the job to queued and the needs_review section
 *      disappears from the UI.
 *   6. The spec then calls the test-only force-complete endpoint to
 *      simulate a successful download callback without actually spinning
 *      up a Hetzner VPS. This validates the full frontend chain all the
 *      way to the "Bereit" section and the library page.
 *
 * The cleanup teardown wipes the created user + orphan NzbFile so the
 * db-test database stays tidy between runs.
 */

test.describe("M021 needs_review single-user flow", () => {
  test.afterEach(async () => {
    await cleanupAllE2EData();
  });

  test("upload unmatchable NZB → assign Matrix → force-complete → visible in library", async ({
    page,
  }) => {
    // ── 1. Register a fresh user via the frontend ─────────────────────
    // Generate the identity first so the email is known before the
    // register call — if registration succeeds server-side but the
    // helper fails on redirect/localStorage, afterEach's cleanup still
    // covers it because cleanupAllE2EData() sweeps ALL e2e-*@test.local
    // users, not just ones we explicitly tracked.
    const identity = generateE2EUserData();
    const user = await registerE2EUser(page, identity);

    // ── 2. Upload an unmatchable NZB directly against the backend ─────
    // The TMDB mock returns { results: [] } for any title it doesn't
    // know, so anything prefixed with "e2e-unmatchable-" guarantees the
    // backend hits its "no match → needs_review" branch.
    const upload = await uploadFreshUnmatchableNzb(user.token);
    expect(upload.needsReview).toBe(true);
    expect(upload.status).toBe("needs_review");

    // ── 3. Visit /downloads and verify the review section exists ──────
    await page.goto("/downloads");
    const needsReviewSection = page.locator("section", {
      hasText: "Zuordnung erforderlich",
    });
    await expect(needsReviewSection).toBeVisible({ timeout: 15000 });
    // Section header carries the count so we can sanity-check the number.
    await expect(needsReviewSection.getByRole("heading")).toContainText(
      "Zuordnung erforderlich (1)",
    );

    // ── 4. Open the AssignMovieDialog for the orphan job ──────────────
    await needsReviewSection.getByRole("button", { name: "Film zuordnen" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Film zuordnen" })).toBeVisible();

    // ── 5. Search "Matrix" → TMDB mock returns Matrix (tmdbId 603) ────
    // The dialog pre-populates the query with a guess from the filename.
    // We overwrite it so we deterministically land on Matrix, which the
    // mock seeds as the only TMDB match for "Matrix".
    const searchInput = dialog.getByPlaceholder("Filmtitel suchen…");
    await searchInput.fill("");
    await searchInput.fill("Matrix");

    // Wait for the debounced search to fire and the mocked result to land.
    // The mock is local + deterministic, so a short timeout suffices.
    const matrixResult = dialog.getByRole("button", { name: /Matrix/ }).first();
    await expect(matrixResult).toBeVisible({ timeout: 5000 });

    // ── 6. Click the Matrix result to assign the job ──────────────────
    await matrixResult.click();

    // The dialog closes on success. The needs_review section should then
    // disappear and the job should show up under "Aktive Downloads".
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(needsReviewSection).not.toBeVisible();

    const activeSection = page.locator("section", { hasText: "Aktive Downloads" });
    await expect(activeSection).toBeVisible({ timeout: 10000 });

    // ── 7. Force-complete via the test-only backend endpoint ──────────
    // This simulates what the download container callback would do on
    // success: flip status=completed, set fake S3 keys, upsert UserLibrary.
    await forceCompleteJob(upload.jobId);

    // ── 8. Reload and verify the job is in "Bereit" section ───────────
    await page.reload();
    const readySection = page.locator("section", { hasText: "Bereit" });
    await expect(readySection).toBeVisible({ timeout: 10000 });
    await expect(readySection.getByRole("heading")).toContainText("Bereit (1)");

    // ── 9. Check the library page — the movie must be there ──────────
    await page.goto("/bibliothek");
    // The library card uses the NzbMovie title ("The Matrix" from the mock).
    // The mock seeds titleEn="The Matrix" / titleDe="Matrix", and the
    // openmedia-api stores titleDe on the NzbMovie row.
    await expect(page.getByRole("heading", { name: /Matrix/i })).toBeVisible({
      timeout: 15000,
    });
  });
});
