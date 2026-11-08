import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Movie } from "@/lib/tmdb";
import { MoviePreviewActions } from "./movie-preview-actions";

const loadMovieCandidates = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/download-context", () => ({
  getStatusLabel: (s: string) => s,
  useDownloads: () => ({
    jobs: [],
    cancelJob: vi.fn(),
    getLink: vi.fn(),
    loadMovieCandidates,
    requestMovie: vi.fn(),
  }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/contexts/watchlist-context", () => ({
  useWatchlist: () => ({ add: vi.fn(), remove: vi.fn(), isInWatchlist: () => false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const movie = { id: 603, title: "Matrix" } as Movie;

beforeEach(() => {
  loadMovieCandidates.mockReset().mockResolvedValue([
    {
      key: "guid:de1080",
      nzbFileId: null,
      guid: "de1080",
      title: "Matrix.1999.German.1080p.WEB-DL",
      group: "german",
      state: "indexer",
      qualityTier: "1080p",
      releaseType: "WEB-DL",
      sizeBytes: 7.8e9,
      audioLanguages: ["de"],
      germanSubtitles: false,
      audioDescription: false,
      inTargetBand: true,
      hashPrefix: null,
      brokenReason: null,
    },
  ]);
});

describe("MoviePreviewActions", () => {
  it("links 'Mehr' to the movie detail page", () => {
    render(<MoviePreviewActions movie={movie} />);
    expect(screen.getByText("Mehr").closest("a")?.getAttribute("href")).toBe(
      "/movie/603",
    );
  });

  it("shows the download button", async () => {
    render(<MoviePreviewActions movie={movie} />);
    expect(await screen.findByText("Verfügbar machen")).toBeTruthy();
  });

  it("shows no download button when nothing is found", async () => {
    loadMovieCandidates.mockResolvedValue([]);
    render(<MoviePreviewActions movie={movie} />);
    await waitFor(() =>
      expect(screen.queryByText("Suche Versionen…")).toBeNull(),
    );
    expect(screen.queryByText("Keine Version gefunden")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("shows the watchlist as an icon button so the row fits", async () => {
    render(<MoviePreviewActions movie={movie} />);
    const button = screen.getByRole("button", { name: "Zur Watchlist hinzufügen" });
    expect(button.textContent).toBe("");
    expect(button.classList.contains("absolute")).toBe(false);
    await screen.findByText("Verfügbar machen");
  });
});
