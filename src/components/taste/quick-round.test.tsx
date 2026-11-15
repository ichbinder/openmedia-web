import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/lib/backend", () => ({ putRating: vi.fn() }));
vi.mock("@/app/actions/quiz", () => ({ getQuizCandidates: vi.fn() }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
import { putRating } from "@/lib/backend";
import { getQuizCandidates } from "@/app/actions/quiz";
import { QuickRound } from "./quick-round";

const titles = [
  { kind: "movie" as const, tmdbId: 1, name: "Heat", year: 1995, posterPath: "/h.jpg" },
  { kind: "show" as const, tmdbId: 2, name: "Dark", year: 2017, posterPath: null },
];

beforeEach(() => {
  vi.mocked(putRating).mockReset().mockResolvedValue({ ok: true, status: 200, data: {} as never });
  vi.mocked(getQuizCandidates).mockReset().mockResolvedValue(titles);
});

async function start(onRated = vi.fn()) {
  render(<QuickRound ratedKeys={["movie-9"]} onRated={onRated} />);
  fireEvent.click(screen.getByRole("button", { name: "Schnell-Runde starten" }));
  await screen.findByText("Heat");
  return onRated;
}

describe("QuickRound", () => {
  it("excludes already rated titles when loading", async () => {
    await start();
    expect(getQuizCandidates).toHaveBeenCalledWith(["movie-9"]);
  });

  it("saves a verdict with source quiz and shows the next title", async () => {
    const onRated = await start();
    fireEvent.click(screen.getByRole("button", { name: /Super/ }));
    expect(await screen.findByText("Dark")).toBeInTheDocument();
    expect(putRating).toHaveBeenCalledWith("movie", 1, { verdict: "up", source: "quiz" }, "tok");
    expect(onRated).toHaveBeenCalledWith("movie-1");
  });

  it("saves nothing for Nicht gesehen and moves on", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Nicht gesehen" }));
    expect(await screen.findByText("Dark")).toBeInTheDocument();
    expect(putRating).not.toHaveBeenCalled();
  });

  it("can be finished at any time", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(screen.getByText("Fertig – 0 Titel bewertet.")).toBeInTheDocument();
  });
});
