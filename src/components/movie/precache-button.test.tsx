import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, cleanup, act, fireEvent } from "@testing-library/react";
import { PrecacheButton } from "./precache-button";

// ── Mocks ──────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/auth", () => ({
  getToken: vi.fn(() => "test-token-123"),
}));

import { getToken } from "@/lib/auth";
const mockGetToken = vi.mocked(getToken);

// ── Setup / Teardown ──────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockFetch.mockReset();
  mockGetToken.mockReturnValue("test-token-123");
});

afterEach(() => {
  act(() => {
    vi.clearAllTimers();
  });
  vi.useRealTimers();
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Helpers ────────────────────────────────────────────────

function mockBackendResponse(
  ok: boolean,
  status: number,
  data: unknown = {},
) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: async () => data,
  });
}

function mockGetIdle() {
  // 404 → idle
  mockBackendResponse(false, 404, { error: "Not found" });
}

function mockGetState(
  state: string,
  opts: {
    reason?: string;
    lastEventAt?: string;
    bytesDownloaded?: number | string;
    sizeBytes?: number | string;
  } = {},
) {
  mockBackendResponse(true, 200, {
    state,
    lastEventAt: opts.lastEventAt ?? new Date().toISOString(),
    reason: opts.reason ?? null,
    bytesDownloaded: opts.bytesDownloaded ?? null,
    sizeBytes: opts.sizeBytes ?? null,
  });
}

function mockPostQueued() {
  mockBackendResponse(true, 200, {
    state: "queued",
    lastEventAt: new Date().toISOString(),
    reason: null,
  });
}

// ── Tests ──────────────────────────────────────────────────

describe("PrecacheButton", () => {
  it("renders idle state with correct label", async () => {
    mockGetIdle(); // initial GET → 404 → idle

    render(<PrecacheButton movieHash="abc123" />);

    // Wait for the initial fetch to resolve
    await waitFor(() => {
      expect(screen.getByText("Für heute Abend laden")).toBeInTheDocument();
    });

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-precache-state", "idle");
    expect(button).toBeEnabled();
  });

  it("sends POST on click and transitions to queued", async () => {
    // Initial GET → idle
    mockGetIdle();
    // POST response → queued
    mockPostQueued();

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Für heute Abend laden")).toBeInTheDocument();
    });

    // Click the button
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Should now show queued state
    await waitFor(() => {
      expect(screen.getByText(/Wartet auf Server/)).toBeInTheDocument();
    });

    // POST was called
    const postCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[1] as Record<string, unknown> | undefined)?.method === "POST",
    );
    expect(postCall).toBeDefined();
    expect((postCall as unknown[])[0]).toContain("/jellyfin/precache/abc123");

    // Button should be disabled
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("starts polling when queued, re-renders on state change to done", async () => {
    // Initial GET → idle
    mockGetIdle();
    // POST → queued
    mockPostQueued();
    // First poll → downloading
    mockGetState("downloading", {
      bytesDownloaded: 500,
      sizeBytes: 1000,
    });
    // Second poll → done
    mockGetState("done");

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Für heute Abend laden")).toBeInTheDocument();
    });

    // Click to trigger POST
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Wartet auf Server/)).toBeInTheDocument();
    });

    // Advance 5s → first poll fires → downloading
    await act(async () => {
      vi.advanceTimersByTime(5_100);
    });

    await waitFor(() => {
      expect(screen.getByText(/50% geladen/)).toBeInTheDocument();
    });

    // Advance another 5s → second poll → done
    await act(async () => {
      vi.advanceTimersByTime(5_100);
    });

    await waitFor(() => {
      expect(screen.getByText("Auf Server bereit")).toBeInTheDocument();
    });

    // Polling should stop — no more fetch calls expected after done
    const fetchCountAfterDone = mockFetch.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    // No additional fetches should have been made
    expect(mockFetch.mock.calls.length).toBe(fetchCountAfterDone);
  });

  it("shows failed state with reason badge", async () => {
    // Initial GET → failed state
    mockGetState("failed", {
      reason: "Disk full on Jellyfin server",
    });

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Erneut versuchen")).toBeInTheDocument();
    });

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-precache-state", "failed");
    expect(button).toBeEnabled();

    // Reason shown as badge
    expect(screen.getByText("Fehler")).toBeInTheDocument();
  });

  it("shows done state with badge", async () => {
    // Initial GET → done state
    mockGetState("done");

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Auf Server bereit")).toBeInTheDocument();
    });

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-precache-state", "done");
    expect(button).toBeDisabled();

    // Badge visible
    expect(screen.getByText("Bereit")).toBeInTheDocument();
  });

  it("does not fetch when no token available", async () => {
    mockGetToken.mockReturnValue(null);

    render(<PrecacheButton movieHash="abc123" />);

    // Wait a tick for any async effects
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Should show idle (default state) but no fetch calls
    expect(screen.getByText("Für heute Abend laden")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
