import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShowCard } from "./show-card";
import type { Show } from "@/lib/tmdb";

const mockMeta = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-title-meta", () => ({ useTitleMeta: mockMeta }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const show: Show = {
  id: 95396,
  name: "Severance",
  original_name: "Severance",
  overview: "",
  poster_path: "/p.jpg",
  backdrop_path: null,
  vote_average: 8.4,
  first_air_date: "2022-02-17",
  genre_ids: [],
};

describe("ShowCard", () => {
  beforeEach(() => mockMeta.mockReturnValue(null));

  it("asks for show meta and shows label and ratings instead of the star", () => {
    mockMeta.mockReturnValue({
      kind: "show",
      tmdbId: 95396,
      label: "APPLE TV+",
      brand: "apple",
      ratings: { critics: 97, audience: 88 },
      score: null,
    });
    render(<ShowCard show={show} />);
    expect(mockMeta).toHaveBeenCalledWith("show", 95396);
    expect(screen.getByText("APPLE TV+")).toBeTruthy();
    expect(screen.getByText("🍅 97% · 🍿 88%")).toBeTruthy();
    expect(screen.queryByText("8.4")).toBeNull();
  });

  it("links to the series page and shows title and year", () => {
    render(<ShowCard show={show} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/serie/95396");
    expect(screen.getByText("Severance")).toBeTruthy();
    expect(screen.getByText("2022")).toBeTruthy();
  });
});
