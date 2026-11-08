import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { SeasonList } from "./season-list";

vi.mock("@/lib/auth", () => ({ getToken: vi.fn(() => "tok") }));
vi.mock("@/lib/backend", () => ({
  getNzbShowByTmdb: vi.fn(),
  getDownloadLink: vi.fn(),
  requestEpisodes: vi.fn(),
  getReleaseCandidates: vi.fn(),
}));
const mockGetStreamUrl = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/download-context", () => ({
  useDownloads: () => ({ getStreamUrl: mockGetStreamUrl, refresh: mockRefresh }),
}));
vi.mock("@/components/movie/video-player", () => ({
  VideoPlayer: () => <div data-testid="player" />,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { getNzbShowByTmdb, getDownloadLink, requestEpisodes, getReleaseCandidates } from "@/lib/backend";
const mockGetShow = vi.mocked(getNzbShowByTmdb);
const mockDownload = vi.mocked(getDownloadLink);
const mockRequest = vi.mocked(requestEpisodes);
const mockCandidates = vi.mocked(getReleaseCandidates);

function showWith(nzbFiles: unknown[]) {
  return {
    ok: true,
    status: 200,
    data: {
      show: {
        episodes: [
          { id: "e", season: 1, episode: 1, titleDe: null, airDate: null, nzbFiles },
        ],
      },
    },
  } as never;
}

const ep = (n: number, name: string) => ({
  episode_number: n,
  name,
  overview: "",
  air_date: "2022-02-18",
  still_path: null,
  runtime: null,
});
const summary = (n: number, name: string) => ({
  season_number: n,
  name,
  episode_count: 2,
  air_date: null,
  poster_path: null,
});

const seasons = [
  { summary: summary(2, "Staffel 2"), episodes: [ep(2, "Zwei"), ep(1, "Eins")], failed: false },
  { summary: summary(0, "Specials"), episodes: [ep(1, "Bonus")], failed: false },
  { summary: summary(1, "Staffel 1"), episodes: [ep(1, "Pilot")], failed: false },
];

beforeEach(() => {
  mockGetShow.mockReset();
  mockGetStreamUrl.mockReset();
  mockDownload.mockReset();
  mockRequest.mockReset();
  window.location.hash = "";
  mockGetShow.mockResolvedValue({ ok: false, status: 404, data: null as never });
});

describe("SeasonList", () => {
  it("shows no badge for episodes without versions", async () => {
    render(<SeasonList showId={1} seasons={seasons} />);
    await waitFor(() => expect(mockGetShow).toHaveBeenCalled());
    expect(screen.queryByText("1080p")).toBeNull();
    expect(screen.queryByText("Abspielen")).toBeNull();
  });

  it("shows a quality badge for an episode with a 1080p version", async () => {
    mockGetShow.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        show: {
          episodes: [
            {
              id: "e",
              season: 1,
              episode: 1,
              titleDe: null,
              airDate: null,
              nzbFiles: [
                { id: "f", qualityTier: "1080p", resolution: null, s3Key: "k", s3StreamKey: "s" },
              ],
            },
          ],
        },
      },
    } as never);
    render(<SeasonList showId={1} seasons={seasons} />);
    const row = document.getElementById("S01E01")!;
    await waitFor(() => expect(within(row).getByText("1080p")).toBeTruthy());
    expect(within(row).getByText("Abspielen")).toBeTruthy();
    expect(within(row).getByText("Laden")).toBeTruthy();
  });

  it("orders seasons and episodes ascending and labels season 0 Specials", () => {
    render(<SeasonList showId={1} seasons={seasons} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Specials", "Staffel 1", "Staffel 2"]);
    const ids = Array.from(document.querySelectorAll("[id^='S0']")).map((e) => e.id);
    expect(ids).toEqual(["S00E01", "S01E01", "S02E01", "S02E02"]);
  });

  it("toasts on a non-404 failure and still renders episodes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetShow.mockResolvedValue({ ok: false, status: 500, data: null as never });
    render(<SeasonList showId={1} seasons={seasons} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText(/Pilot/)).toBeTruthy();
  });

  it("does not toast on 404", async () => {
    vi.mocked(toast.error).mockClear();
    render(<SeasonList showId={1} seasons={seasons} />);
    await waitFor(() => expect(mockGetShow).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("re-enables buttons when the download throws", async () => {
    vi.mocked(toast.error).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetShow.mockResolvedValue(
      showWith([{ id: "f", qualityTier: "1080p", resolution: null, s3Key: "k", s3StreamKey: "s" }]),
    );
    mockDownload.mockRejectedValue(new Error("boom"));
    render(<SeasonList showId={1} seasons={seasons} />);
    const row = document.getElementById("S01E01")!;
    const laden = await within(row).findByText("Laden");
    fireEvent.click(laden);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Download fehlgeschlagen"));
    expect(mockDownload).toHaveBeenCalledWith("f", "tok");
    const button = within(row).getByText("Laden").closest("button")!;
    expect(button.disabled).toBe(false);
    expect((within(row).getByText("Abspielen").closest("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("offers Laden for a version without s3StreamKey and plays the best streamable one", async () => {
    mockGetShow.mockResolvedValue(
      showWith([
        { id: "a", qualityTier: "2160p", resolution: null, s3Key: null, s3StreamKey: null },
        { id: "b", qualityTier: "720p", resolution: null, s3Key: "k", s3StreamKey: "s" },
        { id: "c", qualityTier: "1080p", resolution: null, s3Key: "k", s3StreamKey: null },
      ]),
    );
    mockDownload.mockResolvedValue({ ok: true, status: 200, data: { url: "u" } } as never);
    mockGetStreamUrl.mockResolvedValue("http://stream");
    vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SeasonList showId={1} seasons={seasons} />);
    const row = document.getElementById("S01E01")!;
    await within(row).findByText("2160p");
    expect(within(row).getAllByText("Abspielen")).toHaveLength(1);
    fireEvent.click(within(row).getByText("Laden"));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith("c", "tok"));
    fireEvent.click(within(row).getByText("Abspielen"));
    await waitFor(() => expect(mockGetStreamUrl).toHaveBeenCalledWith("b"));
  });

  it("prefers the larger of two versions and plays the one picked in the list", async () => {
    const version = (id: string, fileSize: string, duration: number, group: string) => ({
      id,
      qualityTier: "1080p",
      resolution: null,
      s3Key: "k",
      s3StreamKey: "s",
      status: "untested",
      fileSize,
      duration,
      originalFilename: `Show.S01E01.GERMAN.DL.1080p.WEB.h264-${group}.nzb`,
    });
    mockGetShow.mockResolvedValue(
      showWith([version("sample", "47385232", 63, "SAUERKRAUT"), version("full", "2909735046", 3240, "ZeroTwo")]),
    );
    mockGetStreamUrl.mockResolvedValue("http://stream");
    render(<SeasonList showId={1} seasons={seasons} />);
    const row = document.getElementById("S01E01")!;
    const select = (await within(row).findByLabelText("Version für S01E01")) as HTMLSelectElement;
    expect(select.value).toBe("full");
    expect(within(row).getByText("1080p · 2,9 GB · 54 Min · ZeroTwo")).toBeTruthy();
    expect(within(row).getByText("1080p · 47 MB · 1 Min · SAUERKRAUT")).toBeTruthy();
    fireEvent.click(within(row).getByText("Abspielen"));
    await waitFor(() => expect(mockGetStreamUrl).toHaveBeenCalledWith("full"));
    fireEvent.change(select, { target: { value: "sample" } });
    fireEvent.click(within(row).getByText("Abspielen"));
    await waitFor(() => expect(mockGetStreamUrl).toHaveBeenLastCalledWith("sample"));
  });

  it("plays and renders the player when Abspielen is clicked", async () => {
    mockGetShow.mockResolvedValue(
      showWith([{ id: "f", qualityTier: "1080p", resolution: null, s3Key: "k", s3StreamKey: "s" }]),
    );
    mockGetStreamUrl.mockResolvedValue("http://stream");
    render(<SeasonList showId={1} seasons={seasons} />);
    const row = document.getElementById("S01E01")!;
    fireEvent.click(await within(row).findByText("Abspielen"));
    expect(await within(row).findByTestId("player")).toBeTruthy();
    expect(mockGetStreamUrl).toHaveBeenCalledWith("f");
  });

  it("autoplays once when the URL hash matches an episode with a stream", async () => {
    window.location.hash = "#S01E01";
    mockGetShow.mockResolvedValue(
      showWith([{ id: "f", qualityTier: "1080p", resolution: null, s3Key: "k", s3StreamKey: "s" }]),
    );
    mockGetStreamUrl.mockResolvedValue("http://stream");
    render(<SeasonList showId={1} seasons={seasons} />);
    await waitFor(() => expect(mockGetStreamUrl).toHaveBeenCalledWith("f"));
    await screen.findByTestId("player");
    expect(mockGetStreamUrl).toHaveBeenCalledTimes(1);
  });

  it("shows a note for a season that failed to load", () => {
    render(
      <SeasonList
        showId={1}
        seasons={[{ summary: summary(1, "Staffel 1"), episodes: [], failed: true }]}
      />,
    );
    expect(screen.getByText("Staffel konnte gerade nicht geladen werden.")).toBeTruthy();
  });

  describe("requests", () => {
    const one = (air_date: string | null, n = 1) => [
      {
        summary: summary(1, "Staffel 1"),
        episodes: [{ ...ep(n, "Pilot"), air_date }],
        failed: false,
      },
    ];
    const withRequests = (myRequests: unknown[], episodes: unknown[] = []) =>
      ({
        ok: true,
        status: 200,
        data: { show: { episodes }, myRequests },
      }) as never;
    const unplayable = {
      id: "e",
      season: 1,
      episode: 1,
      titleDe: null,
      airDate: null,
      nzbFiles: [{ id: "f", qualityTier: "1080p", resolution: null, s3Key: null, s3StreamKey: null }],
    };

    it("offers Anfordern only for aired episodes without a version", async () => {
      const mixed = [
        {
          summary: summary(1, "Staffel 1"),
          episodes: [
            ep(1, "Alt"),
            { ...ep(2, "Zukunft"), air_date: "2999-01-01" },
            { ...ep(3, "Ohne"), air_date: null },
            ep(4, "Mit"),
          ],
          failed: false,
        },
      ];
      mockGetShow.mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          show: {
            episodes: [
              {
                id: "x",
                season: 1,
                episode: 4,
                titleDe: null,
                airDate: null,
                nzbFiles: [{ id: "f", qualityTier: "1080p", resolution: null, s3Key: "k", s3StreamKey: "s" }],
              },
            ],
          },
        },
      } as never);
      render(<SeasonList showId={7} seasons={mixed} />);
      await within(document.getElementById("S01E04")!).findByText("Abspielen");
      expect(within(document.getElementById("S01E01")!).getByText("Anfordern")).toBeTruthy();
      expect(within(document.getElementById("S01E02")!).queryByText("Anfordern")).toBeNull();
      expect(within(document.getElementById("S01E03")!).queryByText("Anfordern")).toBeNull();
      expect(within(document.getElementById("S01E04")!).queryByText("Anfordern")).toBeNull();
    });

    it("requests an episode and shows the returned status", async () => {
      mockRequest.mockResolvedValue({
        ok: true,
        status: 200,
        data: { requests: [{ season: 1, episode: 1, status: "waiting", waitReason: "no_german" }] },
      });
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const row = document.getElementById("S01E01")!;
      fireEvent.click(await within(row).findByText("Anfordern"));
      await within(row).findByText("Noch keine deutsche Fassung");
      expect(mockRequest).toHaveBeenCalledWith({ tmdbId: 7, season: 1, episode: 1 }, "tok");
      expect(within(row).queryByText("Anfordern")).toBeNull();
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("sends only one request on double click", async () => {
      mockRequest.mockReturnValue(new Promise(() => {}));
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const row = document.getElementById("S01E01")!;
      const button = await within(row).findByText("Anfordern");
      fireEvent.click(button);
      fireEvent.click(button);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it("shows downloading from myRequests without a button", async () => {
      mockGetShow.mockResolvedValue(
        withRequests([{ season: 1, episode: 1, status: "downloading", waitReason: null }]),
      );
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const row = document.getElementById("S01E01")!;
      await within(row).findByText("Wird geladen…");
      expect(within(row).queryByText("Anfordern")).toBeNull();
    });

    it("shows the download status for an episode whose only file is not playable yet", async () => {
      mockGetShow.mockResolvedValue(
        withRequests([{ season: 1, episode: 1, status: "downloading", waitReason: null }], [unplayable]),
      );
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const row = document.getElementById("S01E01")!;
      await within(row).findByText("Wird geladen…");
      expect(within(row).queryByText("Anfordern")).toBeNull();
    });

    it("offers requests for an episode whose only file is not playable", async () => {
      mockGetShow.mockResolvedValue(withRequests([], [unplayable]));
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const row = document.getElementById("S01E01")!;
      await within(row).findByText("1080p");
      expect(within(row).getByText("Anfordern")).toBeTruthy();
      expect(screen.getByText("Staffel anfordern")).toBeTruthy();
    });

    it("offers a re-request for a done episode whose file was evicted", async () => {
      mockGetShow.mockResolvedValue(
        withRequests([{ season: 1, episode: 1, status: "done", waitReason: null }], [unplayable]),
      );
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const row = document.getElementById("S01E01")!;
      await within(row).findByText("Erneut anfordern");
      expect(screen.getByText("Staffel anfordern")).toBeTruthy();
      expect(within(row).queryByText("Wird geladen…")).toBeNull();
    });

    it("offers requests for an episode whose only stored file is broken", async () => {
      const broken = {
        ...unplayable,
        nzbFiles: [{ ...unplayable.nzbFiles[0], s3Key: "k", status: "broken" }],
      };
      mockGetShow.mockResolvedValue(withRequests([], [broken]));
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const row = document.getElementById("S01E01")!;
      await within(row).findByText("1080p");
      expect(within(row).getByText("Anfordern")).toBeTruthy();
    });

    it("offers a season request when the only missing episode expired", async () => {
      mockGetShow.mockResolvedValue(
        withRequests([{ season: 1, episode: 1, status: "expired", waitReason: null }]),
      );
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      await within(document.getElementById("S01E01")!).findByText("Erneut anfordern");
      expect(screen.getByText("Staffel anfordern")).toBeTruthy();
    });

    it("keeps a fresh request status when the initial load answers later", async () => {
      let answer!: (v: unknown) => void;
      mockGetShow.mockReturnValue(new Promise((r) => (answer = r)) as never);
      mockRequest.mockResolvedValue({
        ok: true,
        status: 200,
        data: { requests: [{ season: 1, episode: 1, status: "downloading", waitReason: null }] },
      });
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const row = document.getElementById("S01E01")!;
      fireEvent.click(await within(row).findByText("Anfordern"));
      await within(row).findByText("Wird geladen…");
      answer(withRequests([]));
      await waitFor(() => expect(mockGetShow).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 0));
      expect(within(row).getByText("Wird geladen…")).toBeTruthy();
      expect(within(row).queryByText("Anfordern")).toBeNull();
    });

    it("toasts when TMDB does not know the requested episode", async () => {
      vi.mocked(toast.error).mockClear();
      mockRequest.mockResolvedValue({ ok: true, status: 200, data: { requests: [] } });
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      fireEvent.click(await screen.findByText("Anfordern"));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Folge bei TMDB nicht gefunden"));
    });

    it("shows searching for waiting without reason and offers re-request when expired", async () => {
      mockGetShow.mockResolvedValue(
        withRequests([
          { season: 1, episode: 1, status: "waiting", waitReason: null },
          { season: 1, episode: 2, status: "expired", waitReason: null },
        ]),
      );
      render(
        <SeasonList
          showId={7}
          seasons={[
            { summary: summary(1, "Staffel 1"), episodes: [ep(1, "A"), ep(2, "B")], failed: false },
          ]}
        />,
      );
      await within(document.getElementById("S01E01")!).findByText("Wird gesucht…");
      const expired = document.getElementById("S01E02")!;
      expect(within(expired).getByText("Keine Version gefunden")).toBeTruthy();
      expect(within(expired).getByText("Erneut anfordern")).toBeTruthy();
    });

    it("requests a whole season and toasts the count", async () => {
      mockRequest.mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          requests: [
            { season: 1, episode: 1, status: "searching", waitReason: null },
            { season: 1, episode: 2, status: "searching", waitReason: null },
          ],
        },
      });
      render(
        <SeasonList
          showId={7}
          seasons={[
            { summary: summary(1, "Staffel 1"), episodes: [ep(1, "A"), ep(2, "B")], failed: false },
          ]}
        />,
      );
      fireEvent.click(await screen.findByText("Staffel anfordern"));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 Folgen angefordert"));
      expect(mockRequest).toHaveBeenCalledWith({ tmdbId: 7, season: 1 }, "tok");
      expect(screen.queryByText("Staffel anfordern")).toBeNull();
      expect(screen.getAllByText("Wird gesucht…")).toHaveLength(2);
    });

    it("toasts the indexer-not-configured message", async () => {
      vi.mocked(toast.error).mockClear();
      mockRequest.mockResolvedValue({
        ok: false,
        status: 503,
        data: { error: "x", reason: "indexer_not_configured" },
      });
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      fireEvent.click(await screen.findByText("Anfordern"));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Indexer ist nicht eingerichtet"));
    });

    it("toasts the server error text on other failures", async () => {
      vi.mocked(toast.error).mockClear();
      mockRequest.mockResolvedValue({ ok: false, status: 502, data: { error: "Indexer kaputt", reason: "indexer_error" } });
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      fireEvent.click(await screen.findByText("Anfordern"));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Indexer kaputt"));
    });

    it("expands the version list and updates the episode status after loading one", async () => {
      mockCandidates.mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          candidates: [
            { guid: "g1", title: "t", qualityTier: "1080p", sizeBytes: 3010000000, gbPerHour: 3, inTargetBand: true, germanSubtitles: false, audioDescription: false, releaseType: "WEB-DL", languageSource: "tag" },
          ],
        },
      });
      mockRequest.mockResolvedValue({
        ok: true,
        status: 200,
        data: { requests: [{ season: 1, episode: 1, status: "downloading", waitReason: null }] },
      });
      render(<SeasonList showId={7} seasons={one("2022-02-18")} />);
      const toggle = await screen.findByText("Versionen");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(await screen.findByText("Diese laden"));
      await waitFor(() => expect(screen.getByText("Wird geladen…")).toBeTruthy());
      expect(mockCandidates).toHaveBeenCalledTimes(1);
    });
  });
});
