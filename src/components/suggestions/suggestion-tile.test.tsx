import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SuggestionItem } from "@/lib/backend";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/hooks/use-title-meta", () => ({ useTitleMeta: () => null }));
vi.mock("@/hooks/use-persons", () => ({ usePersons: () => [] }));
const movieActions = vi.hoisted(() => vi.fn());
vi.mock("@/components/preview/preview-tile", () => ({
  PreviewTile: ({ children, actions }: { children: React.ReactNode; actions: (d: null) => React.ReactNode }) => (
    <div>
      {children}
      {actions(null)}
    </div>
  ),
}));
vi.mock("@/components/preview/movie-preview-actions", () => ({
  MoviePreviewActions: (props: unknown) => {
    movieActions(props);
    return null;
  },
}));
vi.mock("@/components/preview/show-preview-actions", () => ({ ShowPreviewActions: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@/lib/backend", () => ({ dismissSuggestion: vi.fn(), putRating: vi.fn(), deleteRating: vi.fn() }));
import { dismissSuggestion, putRating } from "@/lib/backend";
import { SuggestionTile } from "./suggestion-tile";

const movie: SuggestionItem = {
  kind: "movie", tmdbId: 7, name: "Heat", year: 1995, posterPath: "/p.jpg", reason: "Ihr mögt Krimis.",
};
const show: SuggestionItem = { ...movie, kind: "show", tmdbId: 9, name: "Severance" };

async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Mehr Aktionen" }));
}

beforeEach(() => vi.mocked(dismissSuggestion).mockReset());

describe("SuggestionTile", () => {
  it("hands the watchlist a movie carrying the year", () => {
    render(<SuggestionTile item={movie} onGone={vi.fn()} />);
    expect(movieActions).toHaveBeenCalledWith({
      movie: expect.objectContaining({ id: 7, title: "Heat", release_date: "1995-01-01", poster_path: "/p.jpg" }),
    });
  });

  it("shows title, year, reason and links movies and shows to their detail pages", () => {
    const { rerender } = render(<SuggestionTile item={movie} onGone={vi.fn()} />);
    expect(screen.getByText("Heat")).toBeInTheDocument();
    expect(screen.getByText("1995")).toBeInTheDocument();
    expect(screen.getByText("Ihr mögt Krimis.")).toHaveClass("line-clamp-2");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/movie/7");
    rerender(<SuggestionTile item={show} onGone={vi.fn()} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/serie/9");
  });

  it("dismisses via Kein Interesse and reports gone", async () => {
    vi.mocked(dismissSuggestion).mockResolvedValue({ ok: true, status: 200, data: null });
    const onGone = vi.fn();
    render(<SuggestionTile item={movie} onGone={onGone} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Kein Interesse" }));
    await waitFor(() => expect(onGone).toHaveBeenCalled());
    expect(dismissSuggestion).toHaveBeenCalledWith("movie", 7, "tok");
  });

  it("opens the rating panel via Schon gesehen and reports gone after Fertig", async () => {
    vi.mocked(putRating).mockResolvedValue({ ok: true, status: 200, data: null as never });
    const onGone = vi.fn();
    render(<SuggestionTile item={movie} onGone={onGone} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Schon gesehen" }));
    expect(await screen.findByText("Wie war „Heat“?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Super/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await waitFor(() => expect(onGone).toHaveBeenCalled());
  });
});
