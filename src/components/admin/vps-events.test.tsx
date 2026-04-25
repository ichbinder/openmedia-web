import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { VpsEvents } from "./vps-events";

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

const mockEvent = {
  id: "evt-1",
  jobType: "download",
  eventType: "routing_anomaly",
  severity: "warning",
  details: { host: "news.eweka.nl", port: 563, expected: "wg0", actual: "eth0" },
  createdAt: "2026-04-25T12:00:00Z",
  downloadJob: { id: "job-1", status: "downloading", hetznerServerId: 12345 },
  uploadJob: null,
};

describe("VpsEvents", () => {
  it("zeigt Loading-Spinner beim ersten Render", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<VpsEvents />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("zeigt leeren Zustand wenn keine Events existieren", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], total: 0, limit: 20, offset: 0 }),
    });

    render(<VpsEvents />);

    await waitFor(() => {
      expect(screen.getByText("Keine Events vorhanden.")).toBeInTheDocument();
    });
  });

  it("zeigt Events mit Severity-Badge und Details", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [mockEvent], total: 1, limit: 20, offset: 0 }),
    });

    render(<VpsEvents />);

    await waitFor(() => {
      expect(screen.getByText("warning")).toBeInTheDocument();
      expect(screen.getByText("Routing-Anomalie")).toBeInTheDocument();
      expect(screen.getByText(/Download/)).toBeInTheDocument();
    });
  });

  it("zeigt Job-Status und Server-ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [mockEvent], total: 1, limit: 20, offset: 0 }),
    });

    render(<VpsEvents />);

    await waitFor(() => {
      expect(screen.getByText(/downloading/)).toBeInTheDocument();
      expect(screen.getByText(/Server #12345/)).toBeInTheDocument();
    });
  });

  it("zeigt hetznerServerId 0 korrekt an (Regression)", async () => {
    const eventWithZeroServerId = {
      ...mockEvent,
      downloadJob: { ...mockEvent.downloadJob, hetznerServerId: 0 },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [eventWithZeroServerId], total: 1, limit: 20, offset: 0 }),
    });

    render(<VpsEvents />);

    await waitFor(() => {
      expect(screen.getByText(/Server #0/)).toBeInTheDocument();
    });
  });

  it("zeigt Fehler bei API-Fehler", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    render(<VpsEvents />);

    await waitFor(() => {
      expect(screen.getByText("HTTP 500")).toBeInTheDocument();
    });
  });

  it("ruft API mit korrektem Endpoint auf", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], total: 0, limit: 20, offset: 0 }),
    });

    render(<VpsEvents />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/backend/admin/config/vps-events"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
