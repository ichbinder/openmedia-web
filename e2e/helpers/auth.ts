import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";

/**
 * A freshly registered E2E test user — contains the credentials the spec
 * used, the user's token (read from localStorage after register), and the
 * display name. Use together with `cleanupTestUser` in afterEach/afterAll
 * so each spec leaves the db-test database clean.
 */
export interface E2EUser {
  email: string;
  password: string;
  name: string;
  token: string;
}

const DEFAULT_PASSWORD = "e2e-test-password-1234";

/**
 * Generate a unique E2E user identity. Email is prefixed with `e2e-` so
 * the cleanup helper can safely wildcard-delete test users from db-test
 * without touching real fixtures.
 */
export function generateE2EUserData(): Omit<E2EUser, "token"> {
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  return {
    email: `e2e-${suffix}@test.local`,
    password: DEFAULT_PASSWORD,
    name: `E2E ${suffix.slice(-6)}`,
  };
}

/**
 * Register a new user via the frontend /register flow and return their
 * credentials + the token the frontend stashed in localStorage. The token
 * can then be used for direct backend API calls (e.g. uploadNzb) without
 * routing everything through the UI.
 *
 * The helper waits for the post-register redirect to land back at "/" so
 * the localStorage write has definitely happened before we read it.
 */
export async function registerE2EUser(
  page: Page,
  overrides: Partial<Omit<E2EUser, "token">> = {},
): Promise<E2EUser> {
  const identity = { ...generateE2EUserData(), ...overrides };

  await page.goto("/register");
  await page.fill("#name", identity.name);
  await page.fill("#email", identity.email);
  await page.fill("#password", identity.password);
  await page.click("button[type=submit]");

  // Wait for the redirect away from /register — the frontend sends the
  // user back to "/" on success.
  await page.waitForURL((url) => !url.pathname.startsWith("/register"), {
    timeout: 15000,
  });

  const token = await page.evaluate(() =>
    window.localStorage.getItem("openmedia_token"),
  );
  if (!token) {
    throw new Error(
      `[e2e-auth] Register succeeded but no token found in localStorage for ${identity.email}`,
    );
  }

  return { ...identity, token };
}

/**
 * Log an existing user in via the frontend /login flow. Returns the
 * refreshed token from localStorage. Use this when a second browser
 * context needs to authenticate as a user that was previously registered
 * (e.g. the multi-user hash-sharing spec).
 */
export async function loginE2EUser(
  page: Page,
  email: string,
  password: string,
): Promise<string> {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15000,
  });

  const token = await page.evaluate(() =>
    window.localStorage.getItem("openmedia_token"),
  );
  if (!token) {
    throw new Error(`[e2e-auth] Login succeeded but no token in localStorage for ${email}`);
  }
  return token;
}
