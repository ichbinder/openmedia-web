import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { VpnProviders } from "./vpn-providers";

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

const mockVpnProvider = {
  id: "vpn-1",
  name: "Privado VPN",
  protocol: "openvpn" as const,
  configBlob: "••••••••",
  username: "vpnuser",
  password: "••••••••",
  enabled: true,
  createdAt: "2026-04-21T12:00:00Z",
  updatedAt: "2026-04-21T12:00:00Z",
};

describe("VpnProviders", () => {
  it("zeigt Loading-Skeleton beim ersten Render", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<VpnProviders />);
    // Skeletons are rendered
    expect(document.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("zeigt leeren Zustand wenn keine Provider existieren", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: [] }),
    });

    render(<VpnProviders />);

    await waitFor(() => {
      expect(screen.getByText("Keine VPN-Provider konfiguriert.")).toBeInTheDocument();
    });
  });

  it("zeigt Provider-Liste mit Protokoll-Badge", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: [mockVpnProvider] }),
    });

    render(<VpnProviders />);

    await waitFor(() => {
      expect(screen.getByText("Privado VPN")).toBeInTheDocument();
    });

    expect(screen.getByText("OpenVPN")).toBeInTheDocument();
  });

  it("zeigt deaktiviert-Badge für disabled Provider", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        providers: [{ ...mockVpnProvider, enabled: false }],
      }),
    });

    render(<VpnProviders />);

    await waitFor(() => {
      expect(screen.getByText("deaktiviert")).toBeInTheDocument();
    });
  });

  it("zeigt Fehler wenn API fehlschlägt", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    render(<VpnProviders />);

    await waitFor(() => {
      expect(
        screen.getByText("Provider konnten nicht geladen werden."),
      ).toBeInTheDocument();
    });
  });

  it("öffnet Create-Dialog beim Klick auf 'Neuer Provider'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: [] }),
    });

    render(<VpnProviders />);

    await waitFor(() => {
      expect(screen.getByText("Neuer Provider")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Neuer Provider"));

    await waitFor(() => {
      expect(screen.getByText("Neuer VPN-Provider")).toBeInTheDocument();
    });
  });

  it("hat Löschen-Button pro Provider", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: [mockVpnProvider] }),
    });

    render(<VpnProviders />);

    await waitFor(() => {
      expect(screen.getByText("Privado VPN")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText("Privado VPN löschen");
    expect(deleteBtn).toBeInTheDocument();
  });

  it("zeigt Config nach Reveal-Klick", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ providers: [mockVpnProvider] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          provider: {
            ...mockVpnProvider,
            configBlob: "[Interface]\nPrivateKey=abc123",
            password: "geheim123",
          },
        }),
      });

    render(<VpnProviders />);

    await waitFor(() => {
      expect(screen.getByText("Privado VPN")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Daten anzeigen"));

    await waitFor(() => {
      expect(screen.getByText(/\[Interface\]/)).toBeInTheDocument();
    });
  });
});
