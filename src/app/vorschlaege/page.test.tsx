import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SuggestionsView } from "@/lib/backend";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/components/home/continue-row", () => ({ ContinueRow: () => <div>Weiterschauen-Reihe</div> }));
vi.mock("@/components/suggestions/suggestion-row", () => ({
  SuggestionRow: ({ row }: { row: { title: string; items: { reason: string }[] } }) => (
    <section>
      <h2>{row.title}</h2>
      <p>{row.items[0].reason}</p>
    </section>
  ),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/backend", () => ({ getSuggestions: vi.fn() }));
import { getSuggestions } from "@/lib/backend";
import VorschlaegePage from "./page";

const item = { kind: "movie" as const, tmdbId: 1, name: "A", year: 2020, posterPath: null, reason: "Weil gut." };
const respond = (data: SuggestionsView) =>
  vi.mocked(getSuggestions).mockResolvedValue({ ok: true, status: 200, data });

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getSuggestions).mockReset();
});
afterEach(() => vi.useRealTimers());

async function renderPage() {
  await act(async () => {
    render(<VorschlaegePage />);
  });
}

describe("VorschlaegePage", () => {
  it("shows both rows with title and reason, and the Stand", async () => {
    respond({
      status: "ready", running: false, createdAt: new Date().toISOString(),
      rows: [
        { key: "neu", title: "Neu für euch", items: [item] },
        { key: "serien", title: "Serien zum Eintauchen", items: [{ ...item, reason: "Noch ein Grund." }] },
      ],
    });
    await renderPage();
    expect(screen.getByText("Weiterschauen-Reihe")).toBeInTheDocument();
    expect(screen.getByText("Neu für euch")).toBeInTheDocument();
    expect(screen.getByText("Serien zum Eintauchen")).toBeInTheDocument();
    expect(screen.getByText("Weil gut.")).toBeInTheDocument();
    expect(screen.getByText("Noch ein Grund.")).toBeInTheDocument();
    expect(screen.getByText(/Stand: heute/)).toBeInTheDocument();
  });

  it("links to the profile without a key", async () => {
    respond({ status: "no_key", running: false, createdAt: null, rows: [] });
    await renderPage();
    expect(screen.getByRole("link", { name: /Richte die KI-Vorschläge im Profil ein/ })).toHaveAttribute("href", "/profile");
  });

  it("polls every 10 s while nothing is there and stops on unmount", async () => {
    respond({ status: "none", running: true, createdAt: null, rows: [] });
    let unmount = () => {};
    await act(async () => {
      unmount = render(<VorschlaegePage />).unmount;
    });
    expect(screen.getByText("Die ersten Vorschläge werden erstellt …")).toBeInTheDocument();
    expect(getSuggestions).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getSuggestions).toHaveBeenCalledTimes(2);
    unmount();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(getSuggestions).toHaveBeenCalledTimes(2);
  });
});
