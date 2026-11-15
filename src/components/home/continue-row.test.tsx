import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { ContinueRow } from "./continue-row";
import type { ContinueItem } from "@/lib/backend";

const backend = vi.hoisted(() => ({
  getContinueWatching: vi.fn(),
  hideContinue: vi.fn(),
  requestEpisodes: vi.fn(),
}));
const mockMeta = vi.hoisted(() => vi.fn());
const mockGetStream = vi.hoisted(() => vi.fn());

vi.mock("@/lib/backend", () => backend);
vi.mock("@/hooks/use-title-meta", () => ({ useTitleMeta: mockMeta }));
vi.mock("@/lib/auth", () => ({ getToken: vi.fn(() => "tok") }));
vi.mock("@/contexts/download-context", () => ({
  useDownloads: () => ({ getStream: mockGetStream }),
}));
vi.mock("@/components/movie/video-player", () => ({
  VideoPlayer: ({
    startAt,
    nzbFileId,
    onClose,
  }: {
    startAt?: number;
    nzbFileId: string;
    onClose: () => void;
  }) => (
    <div data-testid="player" data-start={startAt} data-file={nzbFileId}>
      <button type="button" onClick={onClose}>
        Player schließen
      </button>
    </div>
  ),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const base: ContinueItem = {
  kind: "movie",
  tmdbId: 11,
  title: "Alien",
  posterPath: "/a.jpg",
  season: null,
  episode: null,
  episodeTitle: null,
  positionSec: 3000,
  durationSec: 6000,
  updatedAt: "2026-11-15T10:00:00Z",
  nzbFileId: "f1",
  request: null,
};
const episode: ContinueItem = {
  ...base,
  kind: "episode",
  tmdbId: 7,
  title: "Severance",
  season: 2,
  episode: 5,
};

function load(...items: ContinueItem[]) {
  backend.getContinueWatching.mockResolvedValue({ ok: true, status: 200, data: { items } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMeta.mockReturnValue(null);
  backend.hideContinue.mockResolvedValue({ ok: true });
});

describe("ContinueRow", () => {
  it("renders nothing for an empty list", async () => {
    load();
    const { container } = render(<ContinueRow />);
    await waitFor(() => expect(backend.getContinueWatching).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("shows title and a 50% bar for a movie", async () => {
    load(base);
    render(<ContinueRow />);
    expect(await screen.findByText("Alien")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
  });

  it("shows season and episode for episodes, no bar without duration", async () => {
    load({ ...episode, durationSec: 0, positionSec: 0 });
    render(<ContinueRow />);
    expect(await screen.findByText("S2 · F5")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("asks for show meta with the show id for an episode", async () => {
    load(episode);
    render(<ContinueRow />);
    await screen.findByText("Severance");
    expect(mockMeta).toHaveBeenCalledWith("show", 7);
  });

  it("hides a tile and calls hideContinue", async () => {
    load(episode);
    render(<ContinueRow />);
    fireEvent.click(await screen.findByLabelText("Aus Weiterschauen entfernen"));
    expect(backend.hideContinue).toHaveBeenCalledWith("show", 7, "tok");
    expect(screen.queryByText("Severance")).toBeNull();
  });

  it("requests an episode without file", async () => {
    load({ ...episode, nzbFileId: null });
    backend.requestEpisodes.mockResolvedValue({
      ok: true,
      status: 200,
      data: { requests: [{ season: 2, episode: 5, status: "searching", waitReason: null }] },
    });
    render(<ContinueRow />);
    fireEvent.click(await screen.findByText("Herunterladen"));
    expect(backend.requestEpisodes).toHaveBeenCalledWith(
      { tmdbId: 7, season: 2, episode: 5 },
      "tok",
    );
    expect(await screen.findByText("Wird gesucht…")).toBeTruthy();
  });

  it("links a movie without file to its detail page", async () => {
    load({ ...base, nzbFileId: null });
    render(<ContinueRow />);
    const link = await screen.findByRole("link");
    expect(link.getAttribute("href")).toBe("/movie/11");
  });

  it("plays from the saved position", async () => {
    load(base);
    mockGetStream.mockResolvedValue({
      url: "u",
      resume: { positionSec: 3000, durationSec: 6000, finished: false },
    });
    render(<ContinueRow />);
    fireEvent.click(await screen.findByText("Alien"));
    const player = await screen.findByTestId("player");
    expect(player.getAttribute("data-start")).toBe("3000");
    expect(player.getAttribute("data-file")).toBe("f1");
  });

  it("reloads the row after the player closes", async () => {
    load({ ...episode, season: 1, episode: 3, nzbFileId: "e3" });
    mockGetStream.mockResolvedValue({ url: "u", resume: null });
    render(<ContinueRow />);
    fireEvent.click(await screen.findByText("S1 · F3"));
    await screen.findByTestId("player");
    load({ ...episode, season: 1, episode: 4, nzbFileId: "e4", positionSec: 0, durationSec: 0 });
    fireEvent.click(screen.getByText("Player schließen"));
    expect(await screen.findByText("S1 · F4", {}, { timeout: 2000 })).toBeTruthy();
    expect(backend.getContinueWatching).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("player")).toBeNull();
  });

  it("starts playback only once on a double click", async () => {
    load(base);
    let resolve: (v: unknown) => void = () => {};
    mockGetStream.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ContinueRow />);
    const tile = await screen.findByText("Alien");
    fireEvent.click(tile);
    fireEvent.click(tile);
    resolve({ url: "u", resume: null });
    await screen.findByTestId("player");
    expect(mockGetStream).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the download request throws", async () => {
    load({ ...episode, nzbFileId: null });
    backend.requestEpisodes.mockRejectedValue(new Error("offline"));
    render(<ContinueRow />);
    fireEvent.click(await screen.findByText("Herunterladen"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Anfrage fehlgeschlagen"));
  });

  it("restores the tile when hiding fails", async () => {
    load(episode);
    backend.hideContinue.mockResolvedValue({ ok: false, status: 500, data: {} });
    render(<ContinueRow />);
    fireEvent.click(await screen.findByLabelText("Aus Weiterschauen entfernen"));
    expect(await screen.findByText("Severance")).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith("Entfernen fehlgeschlagen");
  });
});
