/**
 * Minimal TMDB API mock server for the E2E test suite.
 *
 * Listens on a random free port (unless TMDB_MOCK_PORT is set) and serves
 * the two TMDB endpoints the openmedia-api + openmedia-web codebases touch:
 *
 *   GET /search/movie?query=... → { page, results, total_results, total_pages }
 *   GET /movie/:id              → single movie detail
 *
 * Both endpoints are keyed off a small in-memory fixture list. Queries that
 * don't match any fixture title return an empty results array, which is
 * exactly what triggers the `needs_review` path in the backend. Movie IDs
 * that aren't in the fixture return 404.
 *
 * The server is started by Playwright's globalSetup and torn down by
 * globalTeardown. Both the backend (Express API) and the frontend (Next.js
 * Server Actions) are configured to use this server via TMDB_BASE_URL.
 */

import http from "node:http";
import { URL } from "node:url";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

interface MockMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  video: boolean;
  genre_ids: number[];
  original_language: string;
  // Fields only returned by /movie/:id (details)
  imdb_id?: string;
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  tagline?: string;
  status?: string;
}

/**
 * Tiny fixture catalogue — two movies that cover the S01 + S02 specs.
 * IDs match real TMDB IDs so the openmedia-api searchTmdbMovieById lookup
 * returns a plausible-looking result.
 */
const FIXTURES: MockMovie[] = [
  {
    id: 603,
    title: "Matrix",
    original_title: "The Matrix",
    release_date: "1999-03-31",
    overview:
      "Ein Hacker entdeckt die Wahrheit über die Realität. E2E-Test-Fixture.",
    poster_path: "/p96dm7sCMn4VYAStA6siNz30G1r.jpg",
    backdrop_path: "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
    vote_average: 8.2,
    vote_count: 25000,
    popularity: 99.5,
    adult: false,
    video: false,
    genre_ids: [28, 878],
    original_language: "en",
    imdb_id: "tt0133093",
    runtime: 136,
    genres: [
      { id: 28, name: "Action" },
      { id: 878, name: "Science Fiction" },
    ],
    tagline: "Welcome to the Real World.",
    status: "Released",
  },
  {
    id: 550,
    title: "Fight Club",
    original_title: "Fight Club",
    release_date: "1999-10-15",
    overview:
      "Ein unzufriedener Büroangestellter gründet einen Untergrund-Kampfclub. E2E-Test-Fixture.",
    poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    backdrop_path: "/52AfXWuXCHn3UjD17rBruA9f5qb.jpg",
    vote_average: 8.4,
    vote_count: 27000,
    popularity: 75.2,
    adult: false,
    video: false,
    genre_ids: [18],
    original_language: "en",
    imdb_id: "tt0137523",
    runtime: 139,
    genres: [{ id: 18, name: "Drama" }],
    tagline: "Mischief. Mayhem. Soap.",
    status: "Released",
  },
];

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

function matchesQuery(movie: MockMovie, query: string): boolean {
  const q = query.toLowerCase();
  return (
    movie.title.toLowerCase().includes(q) ||
    movie.original_title.toLowerCase().includes(q)
  );
}

function handleSearch(query: string): object {
  const results = query.trim() ? FIXTURES.filter((m) => matchesQuery(m, query)) : [];
  return {
    page: 1,
    results,
    total_results: results.length,
    total_pages: results.length > 0 ? 1 : 0,
  };
}

function handleMovieDetail(id: number): MockMovie | null {
  return FIXTURES.find((m) => m.id === id) ?? null;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function logRequest(method: string, path: string, status: number): void {
  if (process.env.TMDB_MOCK_QUIET !== "1") {
    console.log(`[tmdb-mock] ${method} ${path} → ${status}`);
  }
}

function createHandler(): http.RequestListener {
  return (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;

      // /search/movie?query=...
      if (method === "GET" && path === "/search/movie") {
        const query = url.searchParams.get("query") ?? "";
        const body = handleSearch(query);
        sendJson(res, 200, body);
        logRequest(method, `${path}?query=${encodeURIComponent(query)}`, 200);
        return;
      }

      // /movie/:id  (also matches /movie/123?append_to_response=...)
      const movieMatch = path.match(/^\/movie\/(\d+)$/);
      if (method === "GET" && movieMatch) {
        const id = Number.parseInt(movieMatch[1], 10);
        const movie = handleMovieDetail(id);
        if (!movie) {
          sendJson(res, 404, {
            status_code: 34,
            status_message: "The resource you requested could not be found.",
          });
          logRequest(method, path, 404);
          return;
        }
        sendJson(res, 200, movie);
        logRequest(method, path, 200);
        return;
      }

      // Unknown path — return TMDB-shaped 404
      sendJson(res, 404, {
        status_code: 34,
        status_message: "The resource you requested could not be found.",
      });
      logRequest(method, path, 404);
    } catch (err) {
      console.error("[tmdb-mock] handler error:", err);
      sendJson(res, 500, { status_code: 500, status_message: "Mock server error" });
    }
  };
}

// ---------------------------------------------------------------------------
// Start / stop API
// ---------------------------------------------------------------------------

export interface TmdbMockServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Start the mock server on the given port (or a random free port if 0).
 * Resolves once the server is actually listening — callers can use
 * `server.url` directly as `TMDB_BASE_URL` for downstream processes.
 */
export function startTmdbMockServer(port = 0): Promise<TmdbMockServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(createHandler());
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      const actualPort = address.port;
      const url = `http://127.0.0.1:${actualPort}`;
      if (process.env.TMDB_MOCK_QUIET !== "1") {
        console.log(`[tmdb-mock] listening on ${url}`);
      }
      resolve({
        url,
        port: actualPort,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) rejectClose(err);
              else resolveClose();
            });
          }),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Standalone entry point
// ---------------------------------------------------------------------------

// Allow running directly (`tsx e2e/tmdb-mock-server.ts`) for ad-hoc debugging.
// Detects main-module execution in ESM without relying on `import.meta.main`.
const isMainModule = process.argv[1]?.endsWith("tmdb-mock-server.ts");
if (isMainModule) {
  const envPort = Number.parseInt(process.env.TMDB_MOCK_PORT ?? "4001", 10);
  startTmdbMockServer(envPort).then((server) => {
    process.on("SIGINT", async () => {
      await server.close();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      await server.close();
      process.exit(0);
    });
  });
}
