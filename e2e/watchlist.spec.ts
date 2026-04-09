import { test, expect } from "@playwright/test";

const testEmail = `wl-${Date.now()}@test.de`;

// Pre-M022 spec — depends on trending movies rendering on the homepage,
// which in turn requires the TMDB mock server to stub /trending/movie/week.
// That endpoint is intentionally not stubbed in S01. Skipped until a later
// slice either extends the mock or rewrites this spec to use the M021
// needs_review path (upload NZB → appears in library → exercise watchlist).
test.describe.skip("Watchlist Flow (pre-M022, needs trending mocks)", () => {
  test.beforeEach(async ({ page }) => {
    // Register + login
    await page.goto("/register");
    await page.fill("#name", "WL Tester");
    await page.fill("#email", testEmail);
    await page.fill("#password", "test123");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("Film zur Watchlist hinzufügen und auf /watchlist sehen", async ({ page }) => {
    // Click first heart button on homepage
    const heartButton = page.locator("button[aria-label='Zur Watchlist hinzufügen']").first();
    await heartButton.click();

    // Should change to "Von Watchlist entfernen"
    await expect(page.locator("button[aria-label='Von Watchlist entfernen']").first()).toBeVisible();

    // Go to watchlist page
    await page.goto("/watchlist");
    await expect(page.locator("h1")).toHaveText("Meine Watchlist");

    // Should have at least 1 film
    await expect(page.locator("text=1 Film")).toBeVisible();
  });
});
