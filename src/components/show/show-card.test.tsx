import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShowCard } from "./show-card";
import type { Show } from "@/lib/tmdb";

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
  it("links to the series page and shows title and year", () => {
    render(<ShowCard show={show} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/serie/95396");
    expect(screen.getByText("Severance")).toBeTruthy();
    expect(screen.getByText("2022")).toBeTruthy();
  });
});
