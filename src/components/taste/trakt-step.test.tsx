import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/lib/backend", () => ({ traktConnect: vi.fn(), traktPoll: vi.fn() }));
import { traktConnect, traktPoll } from "@/lib/backend";
import { TraktStep } from "./trakt-step";

const connect = vi.mocked(traktConnect);
const poll = vi.mocked(traktPoll);
const paired = {
  ok: true,
  status: 200,
  data: { userCode: "ABCD1234", verificationUrl: "https://trakt.tv/activate", expiresIn: 600, interval: 5 },
};

async function startAndTick(ms: number) {
  render(<TraktStep importedAt={null} counts={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Mit Trakt verbinden" }));
  await act(() => vi.advanceTimersByTimeAsync(0));
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

beforeEach(() => {
  vi.useFakeTimers();
  connect.mockReset();
  poll.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("TraktStep", () => {
  it("shows the code and link after connecting", async () => {
    connect.mockResolvedValue(paired);
    poll.mockResolvedValue({ ok: true, status: 200, data: { status: "pending" } });
    await startAndTick(0);
    expect(screen.getByTestId("trakt-code")).toHaveTextContent("ABCD1234");
    expect(screen.getByRole("link", { name: "https://trakt.tv/activate" })).toBeInTheDocument();
  });

  it("waits for each poll answer before scheduling the next", async () => {
    connect.mockResolvedValue(paired);
    let release!: (v: Awaited<ReturnType<typeof traktPoll>>) => void;
    poll.mockImplementationOnce(() => new Promise((r) => (release = r)));
    poll.mockResolvedValue({ ok: true, status: 200, data: { status: "pending" } });
    await startAndTick(5000);
    expect(poll).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(poll).toHaveBeenCalledTimes(1);
    await act(async () => release({ ok: true, status: 200, data: { status: "pending" } }));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("shows the counts when done", async () => {
    connect.mockResolvedValue(paired);
    poll.mockResolvedValue({ ok: true, status: 200, data: { status: "done", counts: { rated: 280, seen: 32, skipped: 4 } } });
    await startAndTick(5000);
    expect(screen.getByText(/312 Titel übernommen \(280 bewertet, 32 gesehen, 4 übersprungen\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erneut importieren" })).toBeInTheDocument();
    expect(screen.queryByTestId("trakt-code")).not.toBeInTheDocument();
  });

  it.each([
    ["expired", "Code abgelaufen – bitte neu starten"],
    ["denied", "Abgelehnt bei Trakt"],
  ] as const)("shows a message for %s", async (status, text) => {
    connect.mockResolvedValue(paired);
    poll.mockResolvedValue({ ok: true, status: 200, data: { status } });
    await startAndTick(5000);
    expect(screen.getByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: "Mit Trakt verbinden" })).toBeEnabled();
  });

  it("explains a missing Trakt setup on 503", async () => {
    connect.mockResolvedValue({ ok: false, status: 503, data: null as never });
    await startAndTick(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Trakt ist noch nicht eingerichtet");
  });

  it("allows a restart after a failed import", async () => {
    connect.mockResolvedValue(paired);
    poll.mockResolvedValue({ ok: false, status: 502, data: null as never });
    await startAndTick(5000);
    expect(screen.getByRole("alert")).toHaveTextContent("Trakt-Import fehlgeschlagen");
    expect(screen.getByRole("button", { name: "Mit Trakt verbinden" })).toBeEnabled();
  });

  it("stops polling on unmount", async () => {
    connect.mockResolvedValue(paired);
    poll.mockResolvedValue({ ok: true, status: 200, data: { status: "pending" } });
    const { unmount } = render(<TraktStep importedAt={null} counts={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Mit Trakt verbinden" }));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(poll).toHaveBeenCalledTimes(1);
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(poll).toHaveBeenCalledTimes(1);
  });
});
