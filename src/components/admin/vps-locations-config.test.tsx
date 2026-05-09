import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react";
import { VpsLocationsConfig } from "./vps-locations-config";

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

const HETZNER_LOCATIONS = [
  { id: 1, name: "hel1", description: "Helsinki DC1", country: "FI", city: "Helsinki", network_zone: "eu-central" },
  { id: 2, name: "fsn1", description: "Falkenstein DC1", country: "DE", city: "Falkenstein", network_zone: "eu-central" },
  { id: 3, name: "nbg1", description: "Nuernberg DC1", country: "DE", city: "Nuernberg", network_zone: "eu-central" },
  { id: 4, name: "ash", description: "Ashburn DC1", country: "US", city: "Ashburn", network_zone: "us-east" },
];

interface FetchOptions {
  entries?: { key: string; value: string }[];
  locations?: typeof HETZNER_LOCATIONS;
  locationsOk?: boolean;
  entriesOk?: boolean;
}

function mockInitialFetch({
  entries = [],
  locations = HETZNER_LOCATIONS,
  locationsOk = true,
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
    if (url.includes("/hetzner-locations")) {
      return Promise.resolve({
        ok: locationsOk,
        json: async () => ({ locations }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("VpsLocationsConfig", () => {
  it("zeigt Loading-State beim ersten Render", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<VpsLocationsConfig />);
    expect(screen.getByText(/Lade VPS-Locations/)).toBeInTheDocument();
  });

  it("zeigt Default-Reihenfolge wenn keine Config gespeichert", async () => {
    mockInitialFetch();
    render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
    });

    // Beide Listen zeigen je 3 Default-Locations in Reihenfolge.
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    // Erste Liste (Download): hel1, fsn1, nbg1
    expect(items[0]).toHaveTextContent(/hel1/);
    expect(items[1]).toHaveTextContent(/fsn1/);
    expect(items[2]).toHaveTextContent(/nbg1/);
    // Zweite Liste (Upload): hel1, fsn1, nbg1
    expect(items[3]).toHaveTextContent(/hel1/);
    expect(items[4]).toHaveTextContent(/fsn1/);
    expect(items[5]).toHaveTextContent(/nbg1/);
  });

  it("liest gespeicherte Reihenfolge separat fuer Download/Upload", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadLocations", value: JSON.stringify(["fsn1", "hel1"]) },
        { key: "uploadLocations", value: JSON.stringify(["nbg1", "fsn1", "hel1"]) },
      ],
    });
    render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
    });

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    // Download: fsn1, hel1
    expect(items[0]).toHaveTextContent(/fsn1/);
    expect(items[1]).toHaveTextContent(/hel1/);
    // Upload: nbg1, fsn1, hel1
    expect(items[2]).toHaveTextContent(/nbg1/);
    expect(items[3]).toHaveTextContent(/fsn1/);
    expect(items[4]).toHaveTextContent(/hel1/);
  });

  it("verschiebt einen Eintrag nach unten via Pfeil-Button", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadLocations", value: JSON.stringify(["hel1", "fsn1", "nbg1"]) },
        { key: "uploadLocations", value: JSON.stringify(["hel1", "fsn1", "nbg1"]) },
      ],
    });
    render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
    });

    // Auf "hel1 nach unten" in der Download-Liste klicken (erste Treffer)
    const downButtons = screen.getAllByRole("button", { name: /hel1 nach unten/ });
    fireEvent.click(downButtons[0]);

    const items = screen.getAllByRole("listitem");
    // Download neu: fsn1, hel1, nbg1
    expect(items[0]).toHaveTextContent(/fsn1/);
    expect(items[1]).toHaveTextContent(/hel1/);
    expect(items[2]).toHaveTextContent(/nbg1/);
  });

  it("entfernt einen Eintrag via X-Button", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadLocations", value: JSON.stringify(["hel1", "fsn1", "nbg1"]) },
        { key: "uploadLocations", value: JSON.stringify(["hel1"]) },
      ],
    });
    render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button", { name: /fsn1 entfernen/ });
    fireEvent.click(removeButtons[0]);

    const items = screen.getAllByRole("listitem");
    // Download nach entfernen von fsn1: hel1, nbg1
    expect(items[0]).toHaveTextContent(/hel1/);
    expect(items[1]).toHaveTextContent(/nbg1/);
  });

  it("sendet zwei PUT-Requests mit JSON-Arrays beim Speichern", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadLocations", value: JSON.stringify(["fsn1", "hel1"]) },
        { key: "uploadLocations", value: JSON.stringify(["nbg1"]) },
      ],
    });
    render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
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
      key: "downloadLocations",
      value: JSON.stringify(["fsn1", "hel1"]),
    });
    expect(bodies).toContainEqual({
      categoryName: "vps",
      key: "uploadLocations",
      value: JSON.stringify(["nbg1"]),
    });
  });

  it("zeigt Fehlermeldung wenn Config-Laden fehlschlaegt und ermoeglicht Retry", async () => {
    mockInitialFetch({ entriesOk: false });

    render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(
        screen.getByText("VPS-Locations konnten nicht geladen werden."),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Speichern/ })).toBeDisabled();

    // Retry: mock succeeds now
    mockInitialFetch();
    fireEvent.click(screen.getByText("Erneut versuchen"));

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Speichern/ })).not.toBeDisabled();
  });

  it("funktioniert auch wenn Hetzner-Endpoint fehlschlaegt (Fallback auf Defaults)", async () => {
    mockInitialFetch({ locationsOk: false });

    render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
    });

    // Speichern-Button ist nicht disabled, weil entries OK war
    expect(screen.getByRole("button", { name: /Speichern/ })).not.toBeDisabled();
    // Default-Locations werden angezeigt
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
  });

  it("zeigt Validierungsfehler wenn Liste leer ist", async () => {
    mockInitialFetch({
      entries: [
        { key: "downloadLocations", value: JSON.stringify(["hel1"]) },
        { key: "uploadLocations", value: JSON.stringify(["hel1"]) },
      ],
    });
    render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
    });

    // Download-Liste leeren
    const removeBtns = screen.getAllByRole("button", { name: /hel1 entfernen/ });
    fireEvent.click(removeBtns[0]);

    fireEvent.click(screen.getByRole("button", { name: /Speichern/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/Mindestens eine Download-Location auswaehlen/),
      ).toBeInTheDocument();
    });

    // Kein PUT
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
        { key: "downloadLocations", value: JSON.stringify(["hel1"]) },
        { key: "uploadLocations", value: JSON.stringify(["hel1", "fsn1"]) },
      ],
    });
    const { container } = render(<VpsLocationsConfig />);

    await waitFor(() => {
      expect(screen.queryByText(/Lade VPS-Locations/)).not.toBeInTheDocument();
    });

    const removeBtns = screen.getAllByRole("button", { name: /hel1 entfernen/ });
    fireEvent.click(removeBtns[0]);

    // Hinweis-Text fuer leere Download-Liste sichtbar (innerhalb der ersten Liste)
    const lists = container.querySelectorAll("ol");
    expect(
      within(lists[0] as HTMLElement).getByText(
        /Default \(hel1, fsn1, nbg1\) wird verwendet/,
      ),
    ).toBeInTheDocument();
  });
});
