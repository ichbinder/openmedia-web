import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { SeasonList } from "./season-list";

vi.mock("@/lib/auth", () => ({ getToken: vi.fn(() => "tok") }));
vi.mock("@/lib/backend", () => ({
  getNzbShowByTmdb: vi.fn(),
  getDownloadLink: vi.fn(),
}));
vi.mock("@/contexts/download-context", () => ({
  useDownloads: () => ({ getStreamUrl: vi.fn() }),
}));
vi.mock("@/components/movie/video-player", () => ({
  VideoPlayer: () => <div data-testid="player" />,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "sonner";
import { getNzbShowByTmdb, getDownloadLink } from "@/lib/backend";
const mockGetShow = vi.mocked(getNzbShowByTmdb);
const mockDownload = vi.mocked(getDownloadLink);

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
  { summary: summary(2, "Staffel 2"), episodes: [ep(2, "Zwei"), ep(1, "Eins")] },
  { summary: summary(0, "Specials"), episodes: [ep(1, "Bonus")] },
  { summary: summary(1, "Staffel 1"), episodes: [ep(1, "Pilot")] },
];

beforeEach(() => {
  mockGetShow.mockReset();
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
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetShow.mockResolvedValue(
      showWith([{ id: "f", qualityTier: "1080p", resolution: null, s3Key: "k", s3StreamKey: null }]),
    );
    mockDownload.mockRejectedValue(new Error("boom"));
    render(<SeasonList showId={1} seasons={seasons} />);
    const row = document.getElementById("S01E01")!;
    const laden = await within(row).findByText("Laden");
    fireEvent.click(laden);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const button = within(row).getByText("Laden").closest("button")!;
    expect(button.disabled).toBe(false);
    expect((within(row).getByText("Abspielen").closest("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the badge but no play button for a version without s3Key, and picks the best playable one", async () => {
    mockGetShow.mockResolvedValue(
      showWith([
        { id: "a", qualityTier: "2160p", resolution: null, s3Key: null, s3StreamKey: null },
        { id: "b", qualityTier: "720p", resolution: null, s3Key: "k", s3StreamKey: null },
        { id: "c", qualityTier: "1080p", resolution: null, s3Key: "k", s3StreamKey: null },
      ]),
    );
    mockDownload.mockResolvedValue({ ok: true, status: 200, data: { url: "u" } } as never);
    vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SeasonList showId={1} seasons={seasons} />);
    const row = document.getElementById("S01E01")!;
    await within(row).findByText("2160p");
    expect(within(row).getAllByText("Abspielen")).toHaveLength(1);
    fireEvent.click(within(row).getByText("Laden"));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith("c", "tok"));
  });
});
