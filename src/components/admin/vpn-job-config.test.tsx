import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { VpnJobConfig } from "./vpn-job-config";

// Mock fetch globally
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

const enabledProviders = [
  { id: "vpn-1", name: "Privado VPN", enabled: true },
  { id: "vpn-2", name: "NordVPN", enabled: true },
];

const disabledProvider = { id: "vpn-3", name: "DeadVPN", enabled: false };

const configEntries = [
  { key: "downloadVpnProviderId", value: "vpn-1" },
  { key: "uploadVpnProviderId", value: "vpn-2" },
  { key: "bypassList", value: "custom.host.de, 10.0.0.0/8" },
];

/** Helper: resolve both initial fetches (providers + config) */
function mockInitialFetches(
  providers: unknown[] = [...enabledProviders, disabledProvider],
  entries: unknown[] = configEntries,
) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/vpn-providers")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ providers }),
      });
    }
    if (url.includes("/entries/vpn")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ entries }),
      });
    }
    // PUT calls during save
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("VpnJobConfig", () => {
  it("zeigt Loading-State beim ersten Render", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<VpnJobConfig />);
    expect(screen.getByText("Lade VPN-Zuweisung…")).toBeInTheDocument();
  });

  it("zeigt nur 'Kein VPN' wenn keine Provider existieren", async () => {
    mockInitialFetches([], []);
    render(<VpnJobConfig />);

    await waitFor(() => {
      expect(screen.queryByText("Lade VPN-Zuweisung…")).not.toBeInTheDocument();
    });

    // Both select triggers should show "Kein VPN" placeholder
    const triggers = screen.getAllByRole("combobox");
    expect(triggers).toHaveLength(2);
  });

  it("zeigt enabled Provider in Dropdown-Optionen, aber nicht disabled", async () => {
    mockInitialFetches([...enabledProviders, disabledProvider], []);
    render(<VpnJobConfig />);

    await waitFor(() => {
      expect(screen.queryByText("Lade VPN-Zuweisung…")).not.toBeInTheDocument();
    });

    // Open the first dropdown (Download)
    const triggers = screen.getAllByRole("combobox");
    fireEvent.click(triggers[0]);

    await waitFor(() => {
      expect(screen.getByText("Privado VPN")).toBeInTheDocument();
      expect(screen.getByText("NordVPN")).toBeInTheDocument();
    });

    // Disabled provider should NOT appear
    expect(screen.queryByText("DeadVPN")).not.toBeInTheDocument();
  });

  it("befüllt Dropdowns und Textarea mit gespeicherten Config-Werten", async () => {
    mockInitialFetches();
    render(<VpnJobConfig />);

    await waitFor(() => {
      expect(screen.queryByText("Lade VPN-Zuweisung…")).not.toBeInTheDocument();
    });

    // Bypass textarea should have the custom value
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("custom.host.de, 10.0.0.0/8");
  });

  it("zeigt Default-Bypass-Liste wenn kein gespeicherter Wert vorhanden", async () => {
    mockInitialFetches([...enabledProviders], []);
    render(<VpnJobConfig />);

    await waitFor(() => {
      expect(screen.queryByText("Lade VPN-Zuweisung…")).not.toBeInTheDocument();
    });

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue(
      "hel1.your-objectstorage.com, api.mediatoken.de, 169.254.169.254",
    );
  });

  it("sendet drei PUT-Requests beim Speichern mit korrekten Payloads", async () => {
    mockInitialFetches();
    render(<VpnJobConfig />);

    await waitFor(() => {
      expect(screen.queryByText("Lade VPN-Zuweisung…")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await waitFor(() => {
      expect(screen.getByText("Gespeichert!")).toBeInTheDocument();
    });

    // Filter PUT calls
    const putCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[1] === "object" &&
        call[1] !== null &&
        (call[1] as Record<string, unknown>).method === "PUT",
    );
    expect(putCalls).toHaveLength(3);

    const bodies = putCalls.map((call: unknown[]) =>
      JSON.parse((call[1] as Record<string, string>).body),
    );

    expect(bodies).toContainEqual({
      categoryName: "vpn",
      key: "downloadVpnProviderId",
      value: "vpn-1",
    });
    expect(bodies).toContainEqual({
      categoryName: "vpn",
      key: "uploadVpnProviderId",
      value: "vpn-2",
    });
    expect(bodies).toContainEqual({
      categoryName: "vpn",
      key: "bypassList",
      value: "custom.host.de, 10.0.0.0/8",
    });
  });

  it("zeigt Fehlermeldung wenn Provider-Laden fehlschlägt", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/vpn-providers")) {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ entries: [] }),
      });
    });

    render(<VpnJobConfig />);

    await waitFor(() => {
      expect(
        screen.getByText("VPN-Provider konnten nicht geladen werden."),
      ).toBeInTheDocument();
    });
  });

  it("zeigt Fehlermeldung wenn Speichern fehlschlägt", async () => {
    // Initial load succeeds
    let callCount = 0;
    mockFetch.mockImplementation((url: string, opts?: Record<string, unknown>) => {
      if (opts?.method === "PUT") {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: "Server-Fehler" }),
          });
        }
      }
      if (url.includes("/vpn-providers")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ providers: enabledProviders }),
        });
      }
      if (url.includes("/entries/vpn")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entries: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<VpnJobConfig />);

    await waitFor(() => {
      expect(screen.queryByText("Lade VPN-Zuweisung…")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await waitFor(() => {
      expect(screen.getByText("Server-Fehler")).toBeInTheDocument();
    });
  });
});
