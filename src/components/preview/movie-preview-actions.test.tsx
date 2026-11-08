import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Movie } from "@/lib/tmdb";
import { MoviePreviewActions } from "./movie-preview-actions";

vi.mock("@/components/movie/download-button", () => ({
  DownloadButton: () => <button>Herunterladen</button>,
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/contexts/watchlist-context", () => ({
  useWatchlist: () => ({ add: vi.fn(), remove: vi.fn(), isInWatchlist: () => false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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

  it("shows the watchlist as an icon button so the row fits", () => {
    render(<MoviePreviewActions movie={movie} />);
    const button = screen.getByRole("button", { name: "Zur Watchlist hinzufügen" });
    expect(button.textContent).toBe("");
    expect(button.classList.contains("absolute")).toBe(false);
  });
});
