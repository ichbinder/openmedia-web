import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Person, RatingView } from "@/lib/backend";
import { RatingPanel } from "./rating-panel";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/lib/backend", () => ({
  putRating: vi.fn(),
  deleteRating: vi.fn(),
}));
import { deleteRating, putRating } from "@/lib/backend";

const title = { kind: "movie" as const, tmdbId: 7, name: "Heat" };
const anna: Person = { id: "a", name: "Anna", limits: [], limitsText: "" };
const ben: Person = { id: "b", name: "Ben", limits: [], limitsText: "" };
const existing: RatingView = {
  kind: "movie", tmdbId: 7, verdict: "meh", tags: [], forWhom: null, source: "app", ratedAt: "2026-01-01",
};

beforeEach(() => {
  vi.mocked(putRating).mockReset().mockResolvedValue({ ok: true, status: 200, data: existing });
  vi.mocked(deleteRating).mockReset().mockResolvedValue({ ok: true, status: 204, data: null });
});

describe("RatingPanel", () => {
  it("disables Fertig until a verdict is chosen", async () => {
    render(<RatingPanel title={title} initial={null} persons={[]} mode="prompt" onDone={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Fertig" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Super/ }));
    expect(screen.getByRole("button", { name: "Fertig" })).toBeEnabled();
  });

  it("hides Für wen with one person", () => {
    render(<RatingPanel title={title} initial={null} persons={[anna]} mode="prompt" onDone={vi.fn()} />);
    expect(screen.queryByText("Für wen?")).not.toBeInTheDocument();
  });

  it("preselects Beide with two persons", () => {
    render(<RatingPanel title={title} initial={null} persons={[anna, ben]} mode="prompt" onDone={vi.fn()} />);
    expect(screen.getByText("Für wen?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beide" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves verdict and tags", async () => {
    const onDone = vi.fn();
    render(<RatingPanel title={title} initial={null} persons={[]} mode="prompt" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /Super/ }));
    fireEvent.click(screen.getByRole("button", { name: "Zäh" }));
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(existing));
    expect(putRating).toHaveBeenCalledWith("movie", 7, { verdict: "up", tags: ["zaeh"], forWhom: null }, "tok");
  });

  it("skips without saving", async () => {
    const onDone = vi.fn();
    render(<RatingPanel title={title} initial={null} persons={[]} mode="prompt" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
    expect(putRating).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(null);
  });

  it("deletes an existing rating in detail mode", async () => {
    const onDone = vi.fn();
    render(<RatingPanel title={title} initial={existing} persons={[]} mode="detail" onDone={onDone} />);
    expect(screen.queryByRole("button", { name: "Überspringen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bewertung löschen" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(null));
    expect(deleteRating).toHaveBeenCalledWith("movie", 7, "tok");
  });
});
