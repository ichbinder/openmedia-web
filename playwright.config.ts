import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the M022 E2E test suite.
 *
 * Architecture:
 *   1. globalSetup starts a TMDB mock server on 127.0.0.1:4001. Both the
 *      backend (via TMDB_BASE_URL) and the frontend (via TMDB_BASE_URL for
 *      Server Actions) point at it, so no spec ever hits the real TMDB API.
 *
 *   2. webServer[0] boots the canonical openmedia-api backend from a
 *      sibling checkout at ../openmedia-api (overridable via API_REPO_PATH
 *      for CI multi-repo checkouts). The backend runs with NODE_ENV=test,
 *      AUTO_PROVISION=false (no real Hetzner VPS), and DATABASE_URL pointed
 *      at the db-test container on port 5433.
 *
 *   3. webServer[1] starts the Next.js dev server from this repo, with the
 *      same TMDB_BASE_URL override so Server Actions also hit the mock.
 *
 * The previous config shelled out to a `server/` snapshot directory inside
 * this repo — that snapshot was always stale and didn't have M021 code.
 * This config intentionally removes that coupling.
 */

const API_REPO_PATH =
  process.env.API_REPO_PATH ?? path.resolve(__dirname, "../openmedia-api");

const TMDB_MOCK_URL = "http://127.0.0.1:4001";
const TEST_DATABASE_URL =
  "postgresql://cinescope_test:cinescope_test@localhost:5433/cinescope_test";
const BACKEND_URL = "http://localhost:4000";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/tmdb-mock-server.ts", "**/helpers/**", "**/fixtures/**"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html"], ["github"]] : "html",
  timeout: 30000,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // Backend: canonical openmedia-api repo. Docker db-test container is
      // expected to be already running (either from a prior local session
      // or from the CI workflow). We don't start it here to avoid racing
      // with globalSetup when multiple configs share the same port.
      command: `cd ${API_REPO_PATH} && npx tsx src/index.ts`,
      url: `${BACKEND_URL}/health`,
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: TEST_DATABASE_URL,
        JWT_SECRET: "e2e-test-secret",
        NODE_ENV: "test",
        // The backend test routes (/test/*) require BOTH NODE_ENV=test
        // AND this explicit opt-in flag. See openmedia-api
        // src/routes/test.ts for the triple-gate rationale.
        ENABLE_TEST_ENDPOINTS: "1",
        AUTO_PROVISION: "false",
        PORT: "4000",
        TMDB_BASE_URL: TMDB_MOCK_URL,
        TMDB_API_KEY: "e2e-mock-key-unused",
        // Minimal dummy values for settings the API may read on startup.
        // None of these are actually used because AUTO_PROVISION=false.
        HETZNER_API_TOKEN: "e2e-unused",
        S3_ACCESS_KEY: "e2e-unused",
        S3_SECRET_KEY: "e2e-unused",
        S3_ENDPOINT: "http://127.0.0.1:9999",
        S3_BUCKET: "e2e-unused",
        S3_REGION: "e2e",
        ENCRYPTION_MASTER_KEY:
          "0000000000000000000000000000000000000000000000000000000000000000",
        NZB_SERVICE_URL: "http://127.0.0.1:9998",
        // Explicitly empty — the nzb-service client short-circuits to a
        // best-effort no-op when SERVICE_API_TOKEN is unset, so the
        // background storeNzbInService call after each /downloads/request
        // returns immediately instead of hanging on a dead NZB_API_URL.
        SERVICE_API_TOKEN: "",
        NZB_API_URL: "http://127.0.0.1:9998",
      },
    },
    {
      // Frontend: this repo's Next.js dev server. BACKEND_URL lets the
      // server-side proxy route /api/backend/* to the test backend above.
      command: "npm run dev",
      url: "http://localhost:3000",
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      env: {
        BACKEND_URL,
        TMDB_BASE_URL: TMDB_MOCK_URL,
        TMDB_API_KEY: "e2e-mock-key-unused",
      },
    },
  ],
});
