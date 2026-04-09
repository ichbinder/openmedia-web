/**
 * Playwright globalSetup — starts the TMDB mock server on a fixed port
 * (4001) before any spec runs. The port is hardcoded because Playwright's
 * `webServer.env` block is evaluated at config load time, before
 * globalSetup runs — so we can't use a dynamically-allocated port to
 * configure the webServers. A fixed port is deterministic and fine for
 * both local and CI use.
 *
 * The server instance is stashed on globalThis so globalTeardown can
 * close it cleanly. If setup ever needs to share more state, prefer
 * writing a small JSON file under `.playwright/` instead.
 */

import { startTmdbMockServer, type TmdbMockServer } from "./tmdb-mock-server";

const TMDB_MOCK_PORT = 4001;

// Stash on globalThis so globalTeardown can reach it. Typed loosely to
// avoid leaking the TmdbMockServer type into the global namespace.
declare global {
  var __TMDB_MOCK_SERVER__: TmdbMockServer | undefined;
}

export default async function globalSetup(): Promise<void> {
  if (globalThis.__TMDB_MOCK_SERVER__) {
    console.log("[global-setup] TMDB mock server already running — reusing");
    return;
  }

  const server = await startTmdbMockServer(TMDB_MOCK_PORT);
  globalThis.__TMDB_MOCK_SERVER__ = server;
  console.log(`[global-setup] TMDB mock server started on ${server.url}`);
}
