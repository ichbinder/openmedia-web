import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { JellyfinPluginSetup } from "./jellyfin-plugin-setup";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// navigator.clipboard mock
const mockWriteText = vi.fn(() => Promise.resolve());
Object.defineProperty(globalThis, "navigator", {
  value: {
    clipboard: { writeText: mockWriteText },
  },
  writable: true,
});

import { toast } from "sonner";
const mockToastSuccess = vi.mocked(toast.success);
const mockToastError = vi.mocked(toast.error);

const SETUP_URL = "/api/backend/jellyfin/plugin/setup";
const MANIFEST_URL = "https://example.com/jellyfin/manifest.json";

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteText.mockResolvedValue(undefined);
});

// ── Helper ─────────────────────────────────────────────────────────

function mockFetchSuccess(response: unknown, status = 200) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const reqUrl = typeof input === "string" ? input : (input as Request).url;
    if (reqUrl.includes("jellyfin/plugin/setup")) {
      return new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  });
}

function mockFetchError(errorMsg: string, status = 500) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const reqUrl = typeof input === "string" ? input : (input as Request).url;
    if (reqUrl.includes("jellyfin/plugin/setup")) {
      return new Response(JSON.stringify({ error: errorMsg }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe("JellyfinPluginSetup", () => {
  it("renders title and description in idle state", () => {
    render(<JellyfinPluginSetup />);

    expect(screen.getByText("Jellyfin Plugin")).toBeInTheDocument();
    expect(
      screen.getByText(/Verbinde dein Jellyfin mit openmedia/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Plugin-URL erstellen/i }),
    ).toBeInTheDocument();
  });

  it("shows loading state when button is clicked", async () => {
    // Use a slow promise so we can observe the loading state
    let resolveResponse: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockReturnValue(pendingPromise as Promise<Response>);

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    // Loading state
    await waitFor(() => {
      expect(screen.getByText("Erstelle…")).toBeInTheDocument();
    });

    // Resolve to clean up
    resolveResponse!(
      new Response(JSON.stringify({ manifestUrl: MANIFEST_URL }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("shows manifest URL with copy button after successful API call", async () => {
    mockFetchSuccess({ manifestUrl: MANIFEST_URL });

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    await waitFor(() => {
      expect(screen.getByTestId("manifest-url-input")).toBeInTheDocument();
    });

    const input = screen.getByTestId("manifest-url-input") as HTMLInputElement;
    expect(input.value).toBe(MANIFEST_URL);
    expect(input).toHaveAttribute("readonly");

    // Copy button visible
    expect(
      screen.getByRole("button", { name: /Kopieren/i }),
    ).toBeInTheDocument();
  });

  it("shows 3-step instructions after successful API call", async () => {
    mockFetchSuccess({ manifestUrl: MANIFEST_URL });

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    await waitFor(() => {
      expect(screen.getByTestId("manifest-url-input")).toBeInTheDocument();
    });

    expect(screen.getByText(/Plugins → Catalog/)).toBeInTheDocument();
    expect(screen.getByText(/Add Plugin Repository/)).toBeInTheDocument();
    expect(
      screen.getByText(/Installiere das openmedia Plugin/),
    ).toBeInTheDocument();
  });

  it("copies URL to clipboard and shows toast on copy click", async () => {
    mockFetchSuccess({ manifestUrl: MANIFEST_URL });

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    await waitFor(() => {
      expect(screen.getByTestId("manifest-url-input")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Kopieren/i }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(MANIFEST_URL);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Manifest-URL kopiert!");
  });

  it("shows error toast when clipboard copy fails", async () => {
    mockFetchSuccess({ manifestUrl: MANIFEST_URL });
    mockWriteText.mockRejectedValue(new Error("clipboard denied"));

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    await waitFor(() => {
      expect(screen.getByTestId("manifest-url-input")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Kopieren/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "URL konnte nicht kopiert werden.",
      );
    });
  });

  it("shows error state when API returns error", async () => {
    mockFetchError("Bereits konfiguriert", 409);

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    await waitFor(() => {
      expect(screen.getByText(/Bereits konfiguriert/)).toBeInTheDocument();
    });

    // Retry button should be present
    expect(
      screen.getByRole("button", { name: /Erneut versuchen/i }),
    ).toBeInTheDocument();
  });

  it("shows generic error when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    await waitFor(() => {
      expect(screen.getByText(/Server nicht erreichbar/)).toBeInTheDocument();
    });
  });

  it("can retry after error", async () => {
    // First call fails
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    await waitFor(() => {
      expect(screen.getByText(/Server nicht erreichbar/)).toBeInTheDocument();
    });

    // Now mock success for retry
    mockFetchSuccess({ manifestUrl: MANIFEST_URL });

    fireEvent.click(screen.getByRole("button", { name: /Erneut versuchen/i }));

    await waitFor(() => {
      expect(screen.getByTestId("manifest-url-input")).toBeInTheDocument();
    });
  });

  it("posts to correct endpoint with correct method", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const reqUrl = typeof input === "string" ? input : (input as Request).url;
      if (reqUrl.includes("jellyfin/plugin/setup")) {
        return new Response(JSON.stringify({ manifestUrl: MANIFEST_URL }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    });

    render(<JellyfinPluginSetup />);

    fireEvent.click(screen.getByRole("button", { name: /Plugin-URL erstellen/i }));

    await waitFor(() => {
      expect(screen.getByTestId("manifest-url-input")).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/backend/jellyfin/plugin/setup",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
