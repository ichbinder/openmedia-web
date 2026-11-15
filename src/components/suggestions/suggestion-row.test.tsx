import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SuggestionRowView } from "@/lib/backend";

vi.mock("./suggestion-tile", () => ({
  SuggestionTile: ({ item, onGone }: { item: { name: string }; onGone: () => void }) => (
    <button onClick={onGone}>{item.name}</button>
  ),
}));
import { SuggestionRow } from "./suggestion-row";

const base = { kind: "movie" as const, year: 2020, posterPath: null, reason: "x" };
const row: SuggestionRowView = {
  key: "neu",
  title: "Neu für euch",
  items: [
    { ...base, tmdbId: 1, name: "Heat" },
    { ...base, tmdbId: 2, name: "Alien" },
  ],
};

describe("SuggestionRow", () => {
  it("removes a gone tile and keeps the other", () => {
    render(<SuggestionRow row={row} />);
    fireEvent.click(screen.getByText("Heat"));
    expect(screen.queryByText("Heat")).not.toBeInTheDocument();
    expect(screen.getByText("Alien")).toBeInTheDocument();
  });

  it("removes the whole row when the last tile is gone", () => {
    render(<SuggestionRow row={row} />);
    fireEvent.click(screen.getByText("Heat"));
    fireEvent.click(screen.getByText("Alien"));
    expect(screen.queryByText("Neu für euch")).not.toBeInTheDocument();
  });
});
