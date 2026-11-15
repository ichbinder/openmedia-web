import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RatingView } from "@/lib/backend";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-persons", () => ({ usePersons: () => [] }));
vi.mock("@/lib/backend", () => ({
  getRating: vi.fn(),
  putRating: vi.fn(),
  deleteRating: vi.fn(),
}));
import { getRating } from "@/lib/backend";
import { RateButton } from "./rate-button";

const up: RatingView = {
  kind: "movie", tmdbId: 7, verdict: "up", tags: [], forWhom: null, source: "app", ratedAt: "2026-01-01",
};

beforeEach(() => vi.mocked(getRating).mockReset());

describe("RateButton", () => {
  it("says Bewerten without a rating", async () => {
    vi.mocked(getRating).mockResolvedValue({ ok: false, status: 404, data: null as never });
    render(<RateButton kind="movie" tmdbId={7} name="Heat" />);
    await waitFor(() => expect(getRating).toHaveBeenCalledWith("movie", 7, "tok"));
    expect(screen.getByRole("button", { name: "Bewerten" })).toBeInTheDocument();
  });

  it("shows the emoji of an existing rating", async () => {
    vi.mocked(getRating).mockResolvedValue({ ok: true, status: 200, data: up });
    render(<RateButton kind="movie" tmdbId={7} name="Heat" />);
    expect(await screen.findByText("👍")).toBeInTheDocument();
    expect(screen.queryByText("Bewerten")).not.toBeInTheDocument();
  });

  it("opens the panel on click", async () => {
    vi.mocked(getRating).mockResolvedValue({ ok: true, status: 200, data: up });
    render(<RateButton kind="movie" tmdbId={7} name="Heat" />);
    fireEvent.click(await screen.findByText("👍"));
    const dialog = await screen.findByRole("dialog", { name: "Bewertung" });
    expect(dialog).toHaveTextContent("Wie war „Heat“?");
    expect(screen.getByRole("button", { name: /Super/ })).toHaveAttribute("aria-pressed", "true");
  });
});
