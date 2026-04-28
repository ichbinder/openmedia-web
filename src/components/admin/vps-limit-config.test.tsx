import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { VpsLimitConfig } from "./vps-limit-config";

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

const savedEntries = [
  { key: "globalLimit", value: "8" },
  { key: "maxUploadVps", value: "2" },
];

function mockInitialFetch(entries: unknown[] = savedEntries) {
  mockFetch.mockImplementation((url: string, opts?: Record<string, unknown>) => {
    if (opts?.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (url.includes("/entries/vps")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ entries }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("VpsLimitConfig", () => {
  it("zeigt Loading-State beim ersten Render", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<VpsLimitConfig />);
    expect(screen.getByText(/Lade VPS-Limits/)).toBeInTheDocument();
  });

  it("zeigt Default-Werte wenn keine Config gespeichert", async () => {
    mockInitialFetch([]);
    render(<VpsLimitConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Limits/)).not.toBeInTheDocument();
    });

    const globalInput = screen.getByLabelText("Globales VPS-Limit");
    const uploadInput = screen.getByLabelText("Upload-Maximum");
    expect(globalInput).toHaveValue(10);
    expect(uploadInput).toHaveValue(3);

    // Computed download max = 10 - 3 = 7
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("befuellt Inputs mit gespeicherten Config-Werten", async () => {
    mockInitialFetch();
    render(<VpsLimitConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Limits/)).not.toBeInTheDocument();
    });

    const globalInput = screen.getByLabelText("Globales VPS-Limit");
    const uploadInput = screen.getByLabelText("Upload-Maximum");
    expect(globalInput).toHaveValue(8);
    expect(uploadInput).toHaveValue(2);

    // Computed download max = 8 - 2 = 6
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("sendet zwei PUT-Requests beim Speichern mit korrekten Payloads", async () => {
    mockInitialFetch();
    render(<VpsLimitConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Limits/)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await waitFor(() => {
      expect(screen.getByText("Gespeichert!")).toBeInTheDocument();
    });

    const putCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[1] === "object" &&
        call[1] !== null &&
        (call[1] as Record<string, unknown>).method === "PUT",
    );
    expect(putCalls).toHaveLength(2);

    const bodies = putCalls.map((call: unknown[]) =>
      JSON.parse((call[1] as Record<string, string>).body),
    );

    expect(bodies).toContainEqual({
      categoryName: "vps",
      key: "globalLimit",
      value: "8",
    });
    expect(bodies).toContainEqual({
      categoryName: "vps",
      key: "maxUploadVps",
      value: "2",
    });
  });

  it("zeigt Validierungsfehler wenn Upload-Max > Global-Limit", async () => {
    mockInitialFetch([
      { key: "globalLimit", value: "3" },
      { key: "maxUploadVps", value: "5" },
    ]);
    render(<VpsLimitConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Limits/)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/Upload-Maximum darf nicht groesser als das globale Limit sein/),
      ).toBeInTheDocument();
    });

    // No PUT calls should have been made
    const putCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[1] === "object" &&
        call[1] !== null &&
        (call[1] as Record<string, unknown>).method === "PUT",
    );
    expect(putCalls).toHaveLength(0);
  });

  it("zeigt Fehlermeldung wenn Config-Laden fehlschlaegt", async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({ ok: false });
    });

    render(<VpsLimitConfig />);

    await waitFor(() => {
      expect(
        screen.getByText("VPS-Limits konnten nicht geladen werden."),
      ).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: /Speichern/ });
    expect(saveButton).toBeDisabled();
  });

  it("zeigt Fehlermeldung wenn Speichern fehlschlaegt", async () => {
    mockFetch.mockImplementation((url: string, opts?: Record<string, unknown>) => {
      if (opts?.method === "PUT") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "Server-Fehler" }),
        });
      }
      if (url.includes("/entries/vps")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entries: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<VpsLimitConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Limits/)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await waitFor(() => {
      expect(screen.getByText("Server-Fehler")).toBeInTheDocument();
    });
  });

  it("berechnet Download-Maximum korrekt bei Eingabeaenderung", async () => {
    mockInitialFetch([]);
    render(<VpsLimitConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Limits/)).not.toBeInTheDocument();
    });

    const globalInput = screen.getByLabelText("Globales VPS-Limit");
    fireEvent.change(globalInput, { target: { value: "5" } });

    // Download max = 5 - 3 = 2
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
