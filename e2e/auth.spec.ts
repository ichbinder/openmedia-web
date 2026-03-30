import { test, expect } from "@playwright/test";

// Unique email per test run to avoid conflicts
const testEmail = `e2e-${Date.now()}@test.de`;
const testPassword = "test123";
const testName = "E2E Tester";

test.describe("Auth Flow", () => {
  test("Register → Redirect → User im Header", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1")).toHaveText("Konto erstellen");

    await page.fill("#name", testName);
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.click("button[type=submit]");

    // Should redirect to home
    await expect(page).toHaveURL("/", { timeout: 10000 });
    // User name should appear in header
    await expect(page.locator("header")).toContainText(testName);
  });

  test("Logout → Anmelden erscheint", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.click("button[type=submit]");
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Click logout button (first button in header after user name)
    await page.locator("header button").first().click();
    await expect(page.locator("header")).toContainText("Anmelden");
  });

  test("Login → Session überlebt Reload", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.click("button[type=submit]");
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.locator("header")).toContainText(testName);

    // Reload
    await page.reload();
    await expect(page.locator("header")).toContainText(testName);
  });

  test("Login mit falschem Passwort zeigt Fehler", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", testEmail);
    await page.fill("#password", "falsches-passwort");
    await page.click("button[type=submit]");

    await expect(page.locator("text=falsch")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("Geschützte Route → Redirect zu Login-Hinweis", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page.locator("text=Anmeldung erforderlich")).toBeVisible();
  });
});
