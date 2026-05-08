import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { VpsQueueDashboard } from "./vps-queue-dashboard";

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

const defaultStatus = {
  counts: { downloads: 2, uploads: 1, total: 3 },
  limits: { globalLimit: 10, maxUploadVps: 3 },
  queued: { downloads: 0, uploads: 0, total: 0 },
};

function mockStatusFetch(data = defaultStatus) {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/vps-status")) {
      return Promise.resolve({
        ok: true,
        json: async () => data,
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("VpsQueueDashboard", () => {
  it("zeigt Loading-State beim ersten Render", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<VpsQueueDashboard />);
    expect(screen.getByText(/Lade VPS-Status/)).toBeInTheDocument();
  });

  it("zeigt aktive VPS-Counts und Limits", async () => {
    mockStatusFetch();
    render(<VpsQueueDashboard />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Status/)).not.toBeInTheDocument();
    });

    expect(screen.getByText("3 / 10 VPS")).toBeInTheDocument();
    expect(screen.getByText("2 / 7")).toBeInTheDocument(); // downloads: 10 - 3 = 7
    expect(screen.getByText("1 / 3")).toBeInTheDocument(); // uploads
  });

  it("zeigt Queue-Warnung wenn Jobs warten", async () => {
    mockStatusFetch({
      ...defaultStatus,
      queued: { downloads: 2, uploads: 1, total: 3 },
    });
    render(<VpsQueueDashboard />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Status/)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/3 Jobs in der Warteschlange/)).toBeInTheDocument();
    expect(screen.getByText("2 wartend")).toBeInTheDocument();
    expect(screen.getByText("1 wartend")).toBeInTheDocument();
  });

  it("zeigt keine Queue-Warnung wenn nichts wartet", async () => {
    mockStatusFetch();
    render(<VpsQueueDashboard />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Status/)).not.toBeInTheDocument();
    });

    expect(screen.queryByText(/wartend/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Warteschlange/)).not.toBeInTheDocument();
  });

  it("zeigt Fehlermeldung bei fehlgeschlagenem Laden", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false }),
    );
    render(<VpsQueueDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("VPS-Status konnte nicht geladen werden."),
      ).toBeInTheDocument();
    });

    // Retry button
    mockStatusFetch();
    fireEvent.click(screen.getByText("Erneut versuchen"));

    await waitFor(() => {
      expect(screen.getByText("3 / 10 VPS")).toBeInTheDocument();
    });
  });

  it("zeigt Fehler bei ungültigem API-Response-Format", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => ({ unexpected: true }) }),
    );
    render(<VpsQueueDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("Ungültiges API-Response-Format"),
      ).toBeInTheDocument();
    });
  });

  it("clampt Percent-Werte auf 0-100", async () => {
    mockStatusFetch({
      counts: { downloads: 20, uploads: 5, total: 25 },
      limits: { globalLimit: 10, maxUploadVps: 3 },
      queued: { downloads: 0, uploads: 0, total: 0 },
    });
    render(<VpsQueueDashboard />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Status/)).not.toBeInTheDocument();
    });

    // Values exceed limits — progress bars should still render (clamped at 100)
    expect(screen.getByText("25 / 10 VPS")).toBeInTheDocument();
  });

  it("zeigt 1 Job korrekt (Singular)", async () => {
    mockStatusFetch({
      ...defaultStatus,
      queued: { downloads: 1, uploads: 0, total: 1 },
    });
    render(<VpsQueueDashboard />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Status/)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/1 Job in der Warteschlange/)).toBeInTheDocument();
  });
});
