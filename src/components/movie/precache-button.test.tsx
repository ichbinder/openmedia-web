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

  it("shows failed state with reason badge mapped to German", async () => {
    // Initial GET → failed state
    mockGetState("failed", {
      reason: "insufficient_disk",
    });

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Erneut versuchen")).toBeInTheDocument();
    });

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-precache-state", "failed");
    expect(button).toBeEnabled();

    // Reason shown as mapped German text
    expect(screen.getByText("Speicher reicht nicht (Server)")).toBeInTheDocument();

    // Badge has data-precache-reason attribute
    const badge = screen.getByText("Speicher reicht nicht (Server)");
    expect(badge).toHaveAttribute("data-precache-reason", "insufficient_disk");
  });

  it("shows raw reason string for unknown failure reasons", async () => {
    mockGetState("failed", {
      reason: "some_unknown_error",
    });

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("some_unknown_error")).toBeInTheDocument();
    });

    const badge = screen.getByText("some_unknown_error");
    expect(badge).toHaveAttribute("data-precache-reason", "some_unknown_error");
  });

  it("shows done state with badge", async () => {
    // Initial GET → done state
    mockGetState("done");

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Auf Server bereit")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /Auf Server bereit/ });
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

  // ── Freigeben (release) tests ────────────────────────

  it("shows Freigeben button in done state", async () => {
    mockGetState("done");

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Auf Server bereit")).toBeInTheDocument();
    });

    const releaseButton = screen.getByText("Freigeben");
    expect(releaseButton).toBeInTheDocument();
    expect(releaseButton).toHaveAttribute("data-precache-action", "release");
  });

  it("clicks Freigeben → DELETE request fired, optimistic state=release_requested", async () => {
    // Initial GET → done
    mockGetState("done");
    // DELETE response → release_requested
    mockBackendResponse(true, 200, {
      state: "release_requested",
      lastEventAt: new Date().toISOString(),
    });

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Auf Server bereit")).toBeInTheDocument();
    });

    // Click Freigeben
    const releaseButton = screen.getByText("Freigeben");
    await act(async () => {
      fireEvent.click(releaseButton);
    });

    // DELETE was called
    const deleteCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[1] as Record<string, unknown> | undefined)?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    expect((deleteCall as unknown[])[0]).toContain("/jellyfin/precache/abc123");

    // Optimistic state → release_requested
    await waitFor(() => {
      expect(screen.getByText("Wird freigegeben…")).toBeInTheDocument();
    });
  });

  it("release_requested state polls until 404 → idle", async () => {
    // Initial GET → release_requested
    mockGetState("release_requested");
    // First poll → 404 (row deleted)
    mockBackendResponse(false, 404, { error: "Not found" });

    render(<PrecacheButton movieHash="abc123" />);

    await waitFor(() => {
      expect(screen.getByText("Wird freigegeben…")).toBeInTheDocument();
    });

    // Advance 5s → poll fires → 404 → idle
    await act(async () => {
      vi.advanceTimersByTime(5_100);
    });

    await waitFor(() => {
      expect(screen.getByText("Für heute Abend laden")).toBeInTheDocument();
    });
  });

  it("maps all known failure reasons to German text", async () => {
    const reasons = [
      { raw: "disk_full_during_download", german: "Speicher voll während Download" },
      { raw: "sha_mismatch", german: "Datei beschädigt (Hash-Mismatch)" },
      { raw: "api_error", german: "Server antwortet nicht" },
    ];

    for (const { raw, german } of reasons) {
      mockFetch.mockReset();
      mockGetState("failed", { reason: raw });

      render(<PrecacheButton movieHash="test-hash" />);

      await waitFor(() => {
        expect(screen.getByText(german)).toBeInTheDocument();
      });

      cleanup();
    }
  });
});
