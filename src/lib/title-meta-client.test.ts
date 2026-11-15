import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { __resetTitleMetaCache, loadTitleMeta } from "./title-meta-client";
import * as backend from "./backend";
import * as auth from "./auth";

vi.mock("./backend", () => ({ getTitleMeta: vi.fn() }));
vi.mock("./auth", () => ({ getToken: vi.fn() }));

const getTitleMeta = vi.mocked(backend.getTitleMeta);

function echo(items: { kind: "movie" | "show"; tmdbId: number }[]) {
  return Promise.resolve({
    ok: true,
    status: 200,
    data: {
      items: items.map((i) => ({ ...i, label: "NETFLIX", brand: "netflix" as const, ratings: {}, score: null })),
    },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetTitleMetaCache();
  getTitleMeta.mockReset();
  getTitleMeta.mockImplementation(echo);
  vi.mocked(auth.getToken).mockReturnValue("tok");
});
afterEach(() => vi.useRealTimers());

describe("loadTitleMeta", () => {
  it("batches simultaneous calls into one request", async () => {
    const results = Promise.all([loadTitleMeta("movie", 1), loadTitleMeta("movie", 2), loadTitleMeta("show", 3)]);
    await vi.advanceTimersByTimeAsync(30);
    const metas = await results;
    expect(getTitleMeta).toHaveBeenCalledTimes(1);
    expect(getTitleMeta.mock.calls[0][0]).toHaveLength(3);
    expect(metas.map((m) => m?.tmdbId)).toEqual([1, 2, 3]);
  });

  it("does not request the same id again", async () => {
    const first = loadTitleMeta("movie", 1);
    await vi.advanceTimersByTimeAsync(30);
    await first;
    const second = loadTitleMeta("movie", 1);
    await vi.advanceTimersByTimeAsync(30);
    await second;
    expect(getTitleMeta).toHaveBeenCalledTimes(1);
  });

  it("splits 130 ids into 60/60/10", async () => {
    const all = Promise.all(Array.from({ length: 130 }, (_, i) => loadTitleMeta("movie", i + 1)));
    await vi.advanceTimersByTimeAsync(30);
    await all;
    expect(getTitleMeta.mock.calls.map((c) => c[0].length)).toEqual([60, 60, 10]);
  });

  it("resolves null when the request throws", async () => {
    getTitleMeta.mockRejectedValue(new Error("boom"));
    const results = Promise.all([loadTitleMeta("movie", 1), loadTitleMeta("movie", 2)]);
    await vi.advanceTimersByTimeAsync(30);
    expect(await results).toEqual([null, null]);
  });

  it("resolves null without a token and sends nothing", async () => {
    vi.mocked(auth.getToken).mockReturnValue(null);
    const result = loadTitleMeta("movie", 1);
    await vi.advanceTimersByTimeAsync(30);
    expect(await result).toBeNull();
    expect(getTitleMeta).not.toHaveBeenCalled();
  });

  it("retries after a failed request", async () => {
    getTitleMeta.mockRejectedValueOnce(new Error("boom"));
    const first = loadTitleMeta("movie", 1);
    await vi.advanceTimersByTimeAsync(30);
    expect(await first).toBeNull();
    const second = loadTitleMeta("movie", 1);
    await vi.advanceTimersByTimeAsync(30);
    expect((await second)?.label).toBe("NETFLIX");
    expect(getTitleMeta).toHaveBeenCalledTimes(2);
  });

  it("does not cache an empty result", async () => {
    getTitleMeta.mockImplementation((items) =>
      Promise.resolve({
        ok: true,
        status: 200,
        data: { items: items.map((i) => ({ ...i, label: null, brand: null, ratings: {}, score: null })) },
      }),
    );
    const first = loadTitleMeta("movie", 1);
    await vi.advanceTimersByTimeAsync(30);
    await first;
    const second = loadTitleMeta("movie", 1);
    await vi.advanceTimersByTimeAsync(30);
    await second;
    expect(getTitleMeta).toHaveBeenCalledTimes(2);
  });
});
