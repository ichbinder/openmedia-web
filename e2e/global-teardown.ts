/**
 * Playwright globalTeardown — stops the TMDB mock server started by
 * globalSetup. Silent no-op if the server isn't running (e.g. globalSetup
 * failed before stashing the instance).
 */

export default async function globalTeardown(): Promise<void> {
  const server = globalThis.__TMDB_MOCK_SERVER__;
  if (!server) {
    console.log("[global-teardown] no TMDB mock server to stop");
    return;
  }

  try {
    await server.close();
    globalThis.__TMDB_MOCK_SERVER__ = undefined;
    console.log("[global-teardown] TMDB mock server stopped");
  } catch (err) {
    console.error("[global-teardown] failed to stop TMDB mock server:", err);
  }
}
