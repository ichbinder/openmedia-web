import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MovieCard } from "./movie-card";
import type { Movie } from "@/lib/tmdb";

const mockMeta = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-title-meta", () => ({ useTitleMeta: mockMeta }));
vi.mock("./watchlist-button", () => ({ WatchlistButton: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const movie: Movie = {
  id: 603,
  title: "Matrix",
  original_title: "The Matrix",
  overview: "",
  poster_path: "/p.jpg",
  backdrop_path: null,
  vote_average: 8.2,
  release_date: "1999-03-31",
  vote_count: 100,
  popularity: 1,
  adult: false,
  media_type: "movie",
  genre_ids: [],
};

describe("MovieCard", () => {
  it("shows origin label and ratings instead of the star", () => {
    mockMeta.mockReturnValue({
      kind: "movie",
      tmdbId: 603,
      label: "NETFLIX",
      brand: "netflix",
      ratings: { critics: 36, audience: 92 },
      score: null,
    });
    render(<MovieCard movie={movie} />);
    expect(mockMeta).toHaveBeenCalledWith("movie", 603);
    expect(screen.getByText("NETFLIX")).toBeTruthy();
    expect(screen.getByText("🍅 36% · 🍿 92%")).toBeTruthy();
    expect(screen.queryByText(/★/)).toBeNull();
    expect(screen.queryByText("8.2")).toBeNull();
  });
});
