import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import type { Movie } from "@/lib/tmdb";
import { addToSearchHistory } from "@/lib/backend";
import { SearchMovieCard } from "./search-movie-card";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/lib/backend", () => ({ addToSearchHistory: vi.fn() }));
vi.mock("@/components/movie/movie-card", () => ({
  MovieCard: () => (
    <>
      <span>Matrix</span>
      {createPortal(<button>Vorschau-Knopf</button>, document.body)}
    </>
  ),
}));

const mockAdd = vi.mocked(addToSearchHistory);
const movie = { id: 603, title: "Matrix" } as Movie;

describe("SearchMovieCard", () => {
  beforeEach(() => {
    mockAdd.mockReset();
    mockAdd.mockResolvedValue({} as never);
  });

  it("saves the movie to the search history when the card is clicked", () => {
    render(<SearchMovieCard movie={movie} />);
    fireEvent.click(screen.getByText("Matrix"));
    expect(mockAdd).toHaveBeenCalledWith("tok", expect.objectContaining({ movieId: 603 }));
  });

  it("ignores clicks inside the portaled preview", () => {
    render(<SearchMovieCard movie={movie} />);
    fireEvent.click(screen.getByText("Vorschau-Knopf"));
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
