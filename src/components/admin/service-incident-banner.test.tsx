import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ServiceIncidentBanner } from "./service-incident-banner";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("ServiceIncidentBanner", () => {
  it("rendert nichts wenn keine Incidents existieren", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ incidents: [] }),
    });

    const { container } = render(<ServiceIncidentBanner />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/backend/admin/config/incidents?active=1",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(container.firstChild).toBeNull();
  });

  it("pollt Incidents alle 30 Sekunden", async () => {
    vi.useFakeTimers();
    try {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ incidents: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ incidents: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ incidents: [] }) });

      render(<ServiceIncidentBanner />);

      // Initial fetch on mount
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // First poll tick
      await vi.advanceTimersByTimeAsync(30_000);
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Second poll tick
      await vi.advanceTimersByTimeAsync(30_000);
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rendert eine Incident-Liste mit Service, Message und Occurrences", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        incidents: [
          {
            id: "inc-1",
            service: "nzb-service",
            operation: "fetch",
            message: "503 Service Unavailable",
            firstSeenAt: "2026-05-09T16:00:00Z",
            lastSeenAt: new Date(Date.now() - 30_000).toISOString(),
            occurrences: 7,
          },
          {
            id: "inc-2",
            service: "hetzner-api",
            operation: null,
            message: "Connection timeout",
            firstSeenAt: "2026-05-09T16:30:00Z",
            lastSeenAt: new Date(Date.now() - 5 * 60_000).toISOString(),
            occurrences: 2,
          },
        ],
      }),
    });

    render(<ServiceIncidentBanner />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/Service-Störungen aktiv/i)).toBeInTheDocument();
    expect(screen.getByText("nzb-service")).toBeInTheDocument();
    expect(screen.getByText("(fetch)")).toBeInTheDocument();
    expect(screen.getByText(/503 Service Unavailable/)).toBeInTheDocument();
    expect(screen.getByText("hetzner-api")).toBeInTheDocument();
    expect(screen.getByText(/Connection timeout/)).toBeInTheDocument();
    expect(screen.getByText(/7×/)).toBeInTheDocument();
    expect(screen.getByText(/2×/)).toBeInTheDocument();
  });

  it("rendert nichts bei Fetch-Fehler", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network down"));

    const { container } = render(<ServiceIncidentBanner />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(container.firstChild).toBeNull();
  });
});
