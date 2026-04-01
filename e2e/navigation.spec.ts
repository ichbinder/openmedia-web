import { test, expect } from "@playwright/test";

test.describe("Navigation & Seiten", () => {
  test("Startseite lädt mit Hero und Trending", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h2")).toContainText("Trending diese Woche");
    // Hero CTA should be present
    await expect(page.locator("a:has-text('Details ansehen')").first()).toBeVisible();
  });

  test("Suche findet Filme", async ({ page }) => {
    await page.goto("/search");
    await page.fill("input", "Matrix");
    // Wait for results (debounced)
    await page.waitForTimeout(1000);
    await expect(page.locator("main")).toContainText("Matrix");
  });

  test("Genre-Seite zeigt Genres", async ({ page }) => {
    await page.goto("/genres");
    // Should show genre chips — use main to avoid nav matches
    await expect(page.locator("main")).toContainText("Action");
    await expect(page.locator("main")).toContainText("Abenteuer");
  });

  test("404-Seite für unbekannte Route", async ({ page }) => {
    await page.goto("/gibts-nicht");
    await expect(page.locator("text=Seite nicht gefunden")).toBeVisible();
  });
});
