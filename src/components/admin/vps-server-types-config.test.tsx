import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react";
import { VpsServerTypesConfig } from "./vps-server-types-config";

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

const HETZNER_SERVER_TYPES = [
  { id: 1, name: "cax11", description: "CAX11", cores: 2, memory: 4, disk: 40, cpuType: "shared", architecture: "arm", deprecated: false },
  { id: 2, name: "cax21", description: "CAX21", cores: 4, memory: 8, disk: 80, cpuType: "shared", architecture: "arm", deprecated: false },
  { id: 3, name: "cpx21", description: "CPX21", cores: 3, memory: 4, disk: 80, cpuType: "shared", architecture: "x86", deprecated: false },
  { id: 4, name: "cpx31", description: "CPX31", cores: 4, memory: 8, disk: 160, cpuType: "shared", architecture: "x86", deprecated: false },
  { id: 5, name: "cpx41", description: "CPX41", cores: 8, memory: 16, disk: 240, cpuType: "shared", architecture: "x86", deprecated: false },
  { id: 6, name: "cpx42", description: "CPX42", cores: 8, memory: 16, disk: 240, cpuType: "shared", architecture: "x86", deprecated: false },
];

interface FetchOptions {
  entries?: { key: string; value: string }[];
  serverTypes?: typeof HETZNER_SERVER_TYPES;
  serverTypesOk?: boolean;
  entriesOk?: boolean;
}

function mockInitialFetch({
  entries = [],
  serverTypes = HETZNER_SERVER_TYPES,
  serverTypesOk = true,
  entriesOk = true,
}: FetchOptions = {}) {
  mockFetch.mockImplementation((url: string, opts?: Record<string, unknown>) => {
    if (opts?.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (url.includes("/entries/vps")) {
      return Promise.resolve({
        ok: entriesOk,
        json: async () => ({ entries }),
      });
    }
    if (url.includes("/hetzner-server-types")) {
      return Promise.resolve({
        ok: serverTypesOk,
        json: async () => ({ serverTypes }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("VpsServerTypesConfig", () => {
  it("zeigt Loading-State beim ersten Render", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<VpsServerTypesConfig />);
    expect(screen.getByText(/Lade VPS-Server-Types/)).toBeInTheDocument();
  });

  it("zeigt Default-Server-Types wenn keine Config gespeichert", async () => {
    mockInitialFetch();
    render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
    });

    // Download default = ["cax21"], Upload default = ["cpx42"]
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/cax21/);
    expect(items[1]).toHaveTextContent(/cpx42/);
  });

  it("liest gespeicherte Reihenfolge separat fuer Download/Upload", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadServerTypes", value: JSON.stringify(["cax11", "cax21", "cpx21"]) },
        { key: "uploadServerTypes", value: JSON.stringify(["cpx42", "cpx41", "cpx31"]) },
      ],
    });
    render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
    });

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    // Download: cax11, cax21, cpx21
    expect(items[0]).toHaveTextContent(/cax11/);
    expect(items[1]).toHaveTextContent(/cax21/);
    expect(items[2]).toHaveTextContent(/cpx21/);
    // Upload: cpx42, cpx41, cpx31
    expect(items[3]).toHaveTextContent(/cpx42/);
    expect(items[4]).toHaveTextContent(/cpx41/);
    expect(items[5]).toHaveTextContent(/cpx31/);
  });

  it("verschiebt einen Eintrag nach unten via Pfeil-Button", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadServerTypes", value: JSON.stringify(["cax11", "cax21", "cpx21"]) },
        { key: "uploadServerTypes", value: JSON.stringify(["cpx42"]) },
      ],
    });
    render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
    });

    const downButtons = screen.getAllByRole("button", { name: /cax11 nach unten/ });
    fireEvent.click(downButtons[0]);

    const items = screen.getAllByRole("listitem");
    // Download neu: cax21, cax11, cpx21
    expect(items[0]).toHaveTextContent(/cax21/);
    expect(items[1]).toHaveTextContent(/cax11/);
    expect(items[2]).toHaveTextContent(/cpx21/);
  });

  it("entfernt einen Eintrag via X-Button", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadServerTypes", value: JSON.stringify(["cax11", "cax21", "cpx21"]) },
        { key: "uploadServerTypes", value: JSON.stringify(["cpx42"]) },
      ],
    });
    render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button", { name: /cax21 entfernen/ });
    fireEvent.click(removeButtons[0]);

    const items = screen.getAllByRole("listitem");
    // Download nach entfernen von cax21: cax11, cpx21
    expect(items[0]).toHaveTextContent(/cax11/);
    expect(items[1]).toHaveTextContent(/cpx21/);
  });

  it("sendet zwei PUT-Requests mit JSON-Arrays beim Speichern", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadServerTypes", value: JSON.stringify(["cax11", "cax21"]) },
        { key: "uploadServerTypes", value: JSON.stringify(["cpx42"]) },
      ],
    });
    render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
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
      key: "downloadServerTypes",
      value: JSON.stringify(["cax11", "cax21"]),
    });
    expect(bodies).toContainEqual({
      categoryName: "vps",
      key: "uploadServerTypes",
      value: JSON.stringify(["cpx42"]),
    });
  });

  it("zeigt Fehlermeldung wenn Config-Laden fehlschlaegt und ermoeglicht Retry", async () => {
    mockInitialFetch({ entriesOk: false });

    render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(
        screen.getByText("VPS-Server-Types konnten nicht geladen werden."),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Speichern/ })).toBeDisabled();

    // Retry: mock succeeds now
    mockInitialFetch();
    fireEvent.click(screen.getByText("Erneut versuchen"));

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Speichern/ })).not.toBeDisabled();
  });

  it("funktioniert auch wenn Hetzner-Endpoint fehlschlaegt (Fallback auf Defaults)", async () => {
    mockInitialFetch({ serverTypesOk: false });

    render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Speichern/ })).not.toBeDisabled();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  it("zeigt Validierungsfehler wenn Liste leer ist", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadServerTypes", value: JSON.stringify(["cax21"]) },
        { key: "uploadServerTypes", value: JSON.stringify(["cpx42"]) },
      ],
    });
    render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
    });

    const removeBtns = screen.getAllByRole("button", { name: /cax21 entfernen/ });
    fireEvent.click(removeBtns[0]);

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/Mindestens einen Download-Server-Type auswaehlen/),
      ).toBeInTheDocument();
    });

    const putCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[1] === "object" &&
        call[1] !== null &&
        (call[1] as Record<string, unknown>).method === "PUT",
    );
    expect(putCalls).toHaveLength(0);
  });

  it("zeigt Default-Hinweis wenn Liste leer wird", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadServerTypes", value: JSON.stringify(["cax21"]) },
        { key: "uploadServerTypes", value: JSON.stringify(["cpx42", "cpx41"]) },
      ],
    });
    const { container } = render(<VpsServerTypesConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Server-Types/)).not.toBeInTheDocument();
    });

    const removeBtns = screen.getAllByRole("button", { name: /cax21 entfernen/ });
    fireEvent.click(removeBtns[0]);

    const lists = container.querySelectorAll("ol");
    expect(
      within(lists[0] as HTMLElement).getByText(
        /Default \(cax21\) wird verwendet/,
      ),
    ).toBeInTheDocument();
  });
});
