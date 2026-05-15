import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ApiTokenManager } from "./api-tokens";

// ── helpers ──────────────────────────────────────────────────────────

function makeToken(overrides: Partial<{
  id: string;
  name: string;
  tokenPrefix: string;
  purpose: string | null;
  label: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}> = {}) {
  return {
    id: "tok-1",
    name: "Test Token",
    tokenPrefix: "abc123",
    purpose: null,
    label: null,
    expiresAt: "2099-12-31T23:59:59.000Z",
    lastUsedAt: null,
    revokedAt: null,
    createdAt: "2025-01-15T10:00:00.000Z",
    ...overrides,
  };
}

const jellyfinToken = makeToken({
  id: "jelly-1",
  name: "Jellyfin Plugin Token",
  tokenPrefix: "jf987",
  purpose: "jellyfin-plugin",
  label: "Jellyfin Plugin (15.01.2025)",
  createdAt: "2025-01-15T10:00:00.000Z",
});

const regularToken = makeToken({
  id: "reg-1",
  name: "Chrome Extension",
  tokenPrefix: "chr456",
  purpose: null,
  label: null,
});

const revokedToken = makeToken({
  id: "rev-1",
  name: "Old Token",
  tokenPrefix: "old789",
  purpose: null,
  label: null,
  revokedAt: "2025-01-01T00:00:00.000Z",
});

// ── mock fetch ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(tokens: ReturnType<typeof makeToken>[]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;

    if (url.endsWith("/auth/api-tokens")) {
      return new Response(
        JSON.stringify({ tokens }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  });
}

// ── tests ────────────────────────────────────────────────────────────

describe("ApiTokenManager", () => {
  it("renders loading skeleton initially", () => {
    // Use a never-resolving fetch so the component stays in loading state
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    render(<ApiTokenManager />);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders empty state when no tokens exist", async () => {
    mockFetch([]);
    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText(/Noch keine API-Tokens erstellt/)).toBeInTheDocument();
    });
  });

  it("renders regular token with token prefix hash", async () => {
    mockFetch([regularToken]);
    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText("Chrome Extension")).toBeInTheDocument();
    });
    expect(screen.getByText("chr456…")).toBeInTheDocument();
  });

  it("renders Jellyfin token with label instead of hash", async () => {
    mockFetch([jellyfinToken]);
    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText("Jellyfin Plugin")).toBeInTheDocument();
    });
    // Label should be displayed
    expect(screen.getByText("Jellyfin Plugin (15.01.2025)")).toBeInTheDocument();
    // Hash should NOT be present for jellyfin tokens
    expect(screen.queryByText("jf987…")).not.toBeInTheDocument();
  });

  it("renders Jellyfin token with default label when label is null", async () => {
    const noLabelToken = makeToken({
      id: "jelly-nolabel",
      name: "Jellyfin Plugin Token",
      tokenPrefix: "jf000",
      purpose: "jellyfin-plugin",
      label: null,
      createdAt: "2025-03-20T10:00:00.000Z",
    });
    mockFetch([noLabelToken]);
    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText("Jellyfin Plugin")).toBeInTheDocument();
    });
    expect(screen.getByText("Jellyfin Plugin (20.03.2025)")).toBeInTheDocument();
  });

  it("shows mixed tokens with correct rendering for each type", async () => {
    mockFetch([regularToken, jellyfinToken]);
    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText("Chrome Extension")).toBeInTheDocument();
      expect(screen.getByText("Jellyfin Plugin")).toBeInTheDocument();
    });
    // Regular token has hash
    expect(screen.getByText("chr456…")).toBeInTheDocument();
    // Jellyfin token has label, not hash
    expect(screen.getByText("Jellyfin Plugin (15.01.2025)")).toBeInTheDocument();
    expect(screen.queryByText("jf987…")).not.toBeInTheDocument();
  });

  it("shows Widerrufen button for regular active tokens", async () => {
    mockFetch([regularToken]);
    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText("Widerrufen")).toBeInTheDocument();
    });
  });

  it("shows Löschen button for Jellyfin tokens", async () => {
    mockFetch([jellyfinToken]);
    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText("Löschen")).toBeInTheDocument();
    });
  });

  it("does not show delete button for revoked tokens", async () => {
    mockFetch([revokedToken]);
    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText("Old Token")).toBeInTheDocument();
    });
    // The revoked badge says "Widerrufen" — we check for the *button* role
    const revokeButtons = screen.queryAllByRole("button", { name: /Widerrufen|Löschen/ });
    expect(revokeButtons).toHaveLength(0);
  });

  it("Jellyfin Löschen opens AlertDialog with correct text", async () => {
    mockFetch([jellyfinToken]);
    render(<ApiTokenManager />);

    await waitFor(() => {
      expect(screen.getByText("Löschen")).toBeInTheDocument();
    });

    // Click the trigger button — it's the first "Löschen" text
    const buttons = screen.getAllByText("Löschen");
    // The trigger button is the one with a Trash2 icon sibling
    const triggerBtn = buttons[0].closest("button");
    expect(triggerBtn).toBeTruthy();
    fireEvent.click(triggerBtn!);

    await waitFor(() => {
      expect(screen.getByText("Jellyfin Plugin Token löschen?")).toBeInTheDocument();
    });
    expect(screen.getByText("Jellyfin-Plugin-Sync wird sofort gestoppt.")).toBeInTheDocument();
    expect(screen.getByText("Abbrechen")).toBeInTheDocument();
  });

  it("Jellyfin AlertDialog confirm triggers DELETE request", async () => {
    const deleteMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;

      if (url.includes("/jelly-1")) {
        deleteMock();
        return new Response(JSON.stringify({}), { status: 200 });
      }

      return new Response(
        JSON.stringify({ tokens: [jellyfinToken] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    render(<ApiTokenManager />);
    await waitFor(() => {
      expect(screen.getByText("Löschen")).toBeInTheDocument();
    });

    // Click trigger
    const buttons = screen.getAllByText("Löschen");
    const triggerBtn = buttons[0].closest("button");
    fireEvent.click(triggerBtn!);

    await waitFor(() => {
      expect(screen.getByText("Jellyfin Plugin Token löschen?")).toBeInTheDocument();
    });

    // Click confirm action — find the Löschen in the AlertDialog footer
    const allButtons = screen.getAllByText("Löschen");
    const confirmBtn = allButtons.find(
      (el) => el.closest("[data-slot='alert-dialog-footer']") !== null,
    );
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    });
  });
});
