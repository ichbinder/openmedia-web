import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Movie } from "@/lib/tmdb";
import { MoviePreviewActions } from "./movie-preview-actions";

vi.mock("@/components/movie/download-button", () => ({
  DownloadButton: () => <button>Herunterladen</button>,
}));
vi.mock("@/components/movie/watchlist-button", () => ({
  WatchlistButton: () => <button>Merken</button>,
}));

const movie = { id: 603, title: "Matrix" } as Movie;

describe("MoviePreviewActions", () => {
  it("links 'Mehr' to the movie detail page", () => {
    render(<MoviePreviewActions movie={movie} />);
    expect(screen.getByText("Mehr").closest("a")?.getAttribute("href")).toBe(
      "/movie/603",
    );
  });

  it("shows the download button", () => {
    render(<MoviePreviewActions movie={movie} />);
    expect(screen.getByText("Herunterladen")).toBeTruthy();
  });
});
