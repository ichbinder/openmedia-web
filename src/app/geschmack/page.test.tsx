import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/components/auth/protected-route", () => ({ ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/hooks/use-persons", () => ({ clearPersonsCache: vi.fn() }));
vi.mock("@/app/actions/quiz", () => ({ getQuizCandidates: vi.fn() }));
vi.mock("@/lib/backend", () => ({
  getTaste: vi.fn(),
  getRatings: vi.fn(),
  putTaste: vi.fn(),
  traktConnect: vi.fn(),
  traktPoll: vi.fn(),
  putRating: vi.fn(),
}));
import { getRatings, getTaste, putTaste, traktConnect, traktPoll, type TasteView } from "@/lib/backend";
import { getQuizCandidates } from "@/app/actions/quiz";
import GeschmackPage from "./page";

const taste: TasteView = {
  exists: true,
  persons: [{ id: "a", name: "Anna", limits: [], limitsText: "" }],
  genres: [],
  likesText: "",
  traktImportedAt: null,
  traktImportCounts: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTaste).mockResolvedValue({ ok: true, status: 200, data: taste });
  vi.mocked(getRatings).mockResolvedValue({ ok: true, status: 200, data: { items: [] } });
  vi.mocked(putTaste).mockReset().mockImplementation(async (body) => ({
    ok: true,
    status: 200,
    data: { ...taste, persons: body.persons.map((p) => ({ ...p, id: p.id ?? "x" })) } as TasteView,
  }));
});

describe("GeschmackPage", () => {
  it("keeps a rename from step 1 when saving limits in step 4", async () => {
    render(<GeschmackPage />);
    const name = await screen.findByLabelText("Name 1");
    fireEvent.change(name, { target: { value: "Anna K." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Speichern" })[0]);
    await waitFor(() => expect(putTaste).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Anna K.", { selector: "legend" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Horror" }));
    const saveButtons = screen.getAllByRole("button", { name: "Speichern" });
    fireEvent.click(saveButtons[saveButtons.length - 1]);
    await waitFor(() => expect(putTaste).toHaveBeenCalledTimes(2));
    expect(vi.mocked(putTaste).mock.calls[1][0].persons).toEqual([
      { id: "a", name: "Anna K.", limits: ["horror"], limitsText: "" },
    ]);
  });

  it("sends a new person without an id", async () => {
    render(<GeschmackPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Person hinzufügen" }));
    fireEvent.change(screen.getByLabelText("Name 2"), { target: { value: "Ben" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Speichern" })[0]);
    await waitFor(() => expect(putTaste).toHaveBeenCalledTimes(1));
    const [kept, added] = vi.mocked(putTaste).mock.calls[0][0].persons;
    expect(kept.id).toBe("a");
    expect(added).toEqual({ name: "Ben", limits: [], limitsText: "" });
    expect(added).not.toHaveProperty("id");
  });

  it("reloads ratings after a Trakt import so the quick round skips imported titles", async () => {
    vi.mocked(traktConnect).mockResolvedValue({
      ok: true,
      status: 200,
      data: { userCode: "CODE", verificationUrl: "https://trakt.tv/activate", expiresIn: 600, interval: 0 },
    });
    vi.mocked(traktPoll).mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: "done", counts: { rated: 1, seen: 0, skipped: 0 } },
    });
    vi.mocked(getQuizCandidates).mockResolvedValue([]);
    render(<GeschmackPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mit Trakt verbinden" }));
    vi.mocked(getRatings).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        items: [
          { kind: "movie", tmdbId: 7, verdict: "up", tags: [], forWhom: null, source: "trakt", ratedAt: "2026-11-15T00:00:00.000Z" },
        ],
      },
    });
    await waitFor(() => expect(getTaste).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getRatings).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Schnell-Runde starten" }));
    await waitFor(() => expect(getQuizCandidates).toHaveBeenCalledWith(["movie-7"]));
  });
});
