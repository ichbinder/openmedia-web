// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

it("forwards the query string to the backend", async () => {
  const fetchMock = vi.fn(async () => Response.json({ candidates: [] }));
  vi.stubGlobal("fetch", fetchMock);
  const req = new NextRequest("http://web/api/backend/series/candidates?tmdbId=95396&season=2&episode=5");

  await GET(req, { params: Promise.resolve({ path: ["series", "candidates"] }) });

  expect(fetchMock).toHaveBeenCalledWith(
    "http://localhost:4000/series/candidates?tmdbId=95396&season=2&episode=5",
    expect.anything(),
  );
});
