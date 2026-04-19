import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { UsenetProviders } from "./usenet-providers";

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

const mockProvider = {
  id: "prov-1",
  name: "Eweka",
  host: "news.eweka.nl",
  postHost: "post.eweka.nl",
  port: 563,
  ssl: true,
  username: "testuser",
  password: "••••••••",
  connections: 20,
  priority: 0,
  enabled: true,
  isDownload: true,
  isUpload: true,
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

describe("UsenetProviders", () => {
  it("zeigt Loading-Skeleton beim ersten Render", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<UsenetProviders />);
    // Skeletons are rendered
    expect(document.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it("zeigt leeren Zustand wenn keine Provider existieren", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: [] }),
    });

    render(<UsenetProviders />);

    await waitFor(() => {
      expect(screen.getByText("Keine Usenet-Provider konfiguriert.")).toBeInTheDocument();
    });
  });

  it("zeigt Provider-Liste mit Badges", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: [mockProvider] }),
    });

    render(<UsenetProviders />);

    await waitFor(() => {
      expect(screen.getByText("Eweka")).toBeInTheDocument();
    });

    expect(screen.getByText("Download")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText(/news\.eweka\.nl:563/)).toBeInTheDocument();
    expect(screen.getByText(/post\.eweka\.nl/)).toBeInTheDocument();
    expect(screen.getByText(/20 Verbindungen/)).toBeInTheDocument();
  });

  it("zeigt deaktiviert-Badge für disabled Provider", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        providers: [{ ...mockProvider, enabled: false }],
      }),
    });

    render(<UsenetProviders />);

    await waitFor(() => {
      expect(screen.getByText("deaktiviert")).toBeInTheDocument();
    });
  });

  it("zeigt Fehler wenn API fehlschlägt", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    render(<UsenetProviders />);

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

    render(<UsenetProviders />);

    await waitFor(() => {
      expect(screen.getByText("Neuer Provider")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Neuer Provider"));

    await waitFor(() => {
      expect(screen.getByText("Neuer Usenet-Provider")).toBeInTheDocument();
    });
  });

  it("hat Löschen-Button pro Provider", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ providers: [mockProvider] }),
    });

    render(<UsenetProviders />);

    await waitFor(() => {
      expect(screen.getByText("Eweka")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText("Eweka löschen");
    expect(deleteBtn).toBeInTheDocument();
  });

  it("zeigt Passwort nach Reveal-Klick", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ providers: [mockProvider] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          provider: { ...mockProvider, password: "geheim123" },
        }),
      });

    render(<UsenetProviders />);

    await waitFor(() => {
      expect(screen.getByText("Eweka")).toBeInTheDocument();
    });

    expect(screen.getByText("••••••••")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Passwort anzeigen"));

    await waitFor(() => {
      expect(screen.getByText("geheim123")).toBeInTheDocument();
    });
  });
});
