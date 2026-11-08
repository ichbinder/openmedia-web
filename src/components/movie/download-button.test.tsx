import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { MovieCandidate } from "@/lib/backend";
import { DownloadButton } from "./download-button";

const { loadMovieCandidates, requestMovie, getLink, toastError } = vi.hoisted(() => ({
  loadMovieCandidates: vi.fn(),
  requestMovie: vi.fn(),
  getLink: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/contexts/download-context", () => ({
  getStatusLabel: (s: string) => s,
  useDownloads: () => ({
    jobs: [],
    cancelJob: vi.fn(),
    getLink,
    loadMovieCandidates,
    requestMovie,
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

const movie = {
  id: 603,
  title: "Matrix",
  poster_path: null,
  vote_average: 8,
  release_date: "1999-03-31",
};

function candidate(overrides: Partial<MovieCandidate> = {}): MovieCandidate {
  return {
    key: "guid:de1080",
    nzbFileId: null,
    guid: "de1080",
    title: "Matrix.1999.German.1080p.WEB-DL",
    group: "german",
    state: "indexer",
    qualityTier: "1080p",
    releaseType: "WEB-DL",
    sizeBytes: 7.8e9,
    audioLanguages: ["de", "en"],
    germanSubtitles: true,
    audioDescription: false,
    inTargetBand: true,
    hashPrefix: null,
    brokenReason: null,
    ...overrides,
  };
}

const english = candidate({
  key: "guid:en1080",
  guid: "en1080",
  group: "foreign",
  audioLanguages: ["en"],
  germanSubtitles: false,
});
const cam = candidate({
  key: "guid:cam",
  guid: "cam",
  group: "cam",
  qualityTier: "720p",
  releaseType: "CAM",
  sizeBytes: 1.2e9,
  germanSubtitles: false,
});
const ownFile = candidate({
  key: "file:11111111-1111-1111-1111-111111111111",
  nzbFileId: "11111111-1111-1111-1111-111111111111",
  guid: null,
  state: "available",
  releaseType: null,
  sizeBytes: null,
  audioLanguages: [],
  germanSubtitles: false,
  hashPrefix: "a3f9c21e",
});

const readyFile = candidate({ ...ownFile, state: "ready", audioLanguages: ["de"] });

beforeEach(() => {
  vi.clearAllMocks();
  loadMovieCandidates.mockResolvedValue([]);
  requestMovie.mockResolvedValue({ ok: true, status: 200 });
});

async function openList() {
  fireEvent.click(await screen.findByRole("button", { name: "Alle Versionen" }));
}

describe("DownloadButton", () => {
  it("shows 'Keine Version gefunden' when nothing is found", async () => {
    render(<DownloadButton movie={movie} />);
    expect(screen.getByText("Suche Versionen…")).toBeTruthy();
    expect(await screen.findByText("Keine Version gefunden")).toBeTruthy();
  });

  it("renders nothing with hideWhenUnavailable when nothing is found", async () => {
    const { container } = render(
      <DownloadButton movie={movie} hideWhenUnavailable />,
    );
    await waitFor(() =>
      expect(screen.queryByText("Suche Versionen…")).toBeNull(),
    );
    expect(loadMovieCandidates).toHaveBeenCalledWith(603);
    expect(container.querySelector("button")).toBeNull();
  });

  it("one click on a German candidate requests it without asking", async () => {
    loadMovieCandidates.mockResolvedValue([candidate()]);
    render(<DownloadButton movie={movie} />);
    fireEvent.click(await screen.findByText("Verfügbar machen"));
    await waitFor(() =>
      expect(requestMovie).toHaveBeenCalledWith({ tmdbId: 603, key: "guid:de1080" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(loadMovieCandidates).toHaveBeenCalledTimes(2));
  });

  it("marks an English-only version and asks before loading", async () => {
    loadMovieCandidates.mockResolvedValue([english]);
    render(<DownloadButton movie={movie} />);
    expect(await screen.findByText("Nur Englisch")).toBeTruthy();
    fireEvent.click(screen.getByText("Verfügbar machen"));
    expect(await screen.findByText("Kein deutscher Ton")).toBeTruthy();
    expect(
      screen.getByText("Diesen Film gibt es bisher nur auf Englisch. Trotzdem laden?"),
    ).toBeTruthy();
    expect(requestMovie).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Englisch laden"));
    await waitFor(() =>
      expect(requestMovie).toHaveBeenCalledWith({
        tmdbId: 603,
        key: "guid:en1080",
        confirmed: true,
      }),
    );
  });

  it("marks a cinema rip and asks before loading", async () => {
    loadMovieCandidates.mockResolvedValue([cam]);
    render(<DownloadButton movie={movie} />);
    expect(await screen.findByText("Kino-Mitschnitt")).toBeTruthy();
    fireEvent.click(screen.getByText("Verfügbar machen"));
    expect(
      await screen.findByText(
        "Diese Version wurde im Kino abgefilmt. Bild und Ton sind schlecht. Trotzdem laden?",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Trotzdem laden"));
    await waitFor(() =>
      expect(requestMovie).toHaveBeenCalledWith({
        tmdbId: 603,
        key: "guid:cam",
        confirmed: true,
      }),
    );
  });

  it("dropdown groups German, non-German and cam rows with quality lines", async () => {
    loadMovieCandidates.mockResolvedValue([
      candidate(),
      ownFile,
      english,
      cam,
      candidate({
        key: "file:22222222-2222-2222-2222-222222222222",
        state: "broken",
        brokenReason: "Archiv unvollständig",
        hashPrefix: "deadbeef",
      }),
    ]);
    render(<DownloadButton movie={movie} />);
    await openList();
    for (const label of ["Deutsch", "Kein Deutsch", "Fehlerhaft"]) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText("Kino-Mitschnitt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1080p · WEB-DL · 7,8 GB").length).toBe(2);
    expect(
      screen.getByText("Deutsch + Englisch · Untertitel DE · Empfohlen"),
    ).toBeTruthy();
    expect(screen.getByText("1080p · eigene NZB · a3f9c21e")).toBeTruthy();
    expect(screen.getByText("Sprache unbekannt · schon im Bestand")).toBeTruthy();
    expect(screen.getByText("720p · CAM · 1,2 GB")).toBeTruthy();
    expect(screen.getByText("Archiv unvollständig")).toBeTruthy();
  });

  it("a row click sends manual: true", async () => {
    loadMovieCandidates.mockResolvedValue([candidate(), ownFile]);
    render(<DownloadButton movie={movie} />);
    await openList();
    fireEvent.click(await screen.findByText("1080p · eigene NZB · a3f9c21e"));
    await waitFor(() =>
      expect(requestMovie).toHaveBeenCalledWith({
        tmdbId: 603,
        key: ownFile.key,
        manual: true,
      }),
    );
  });

  it("shows the daily limit after a 429", async () => {
    loadMovieCandidates.mockResolvedValue([candidate()]);
    requestMovie.mockResolvedValue({ ok: false, status: 429, reason: "budget" });
    render(<DownloadButton movie={movie} />);
    fireEvent.click(await screen.findByText("Verfügbar machen"));
    const limit = await screen.findByText("Tageslimit erreicht — morgen wieder");
    expect(limit.closest("button")?.disabled).toBe(true);
  });

  it("reloads the list and toasts after candidate_gone", async () => {
    loadMovieCandidates
      .mockResolvedValueOnce([candidate()])
      .mockResolvedValueOnce([english]);
    requestMovie.mockResolvedValue({
      ok: false,
      status: 404,
      reason: "candidate_gone",
    });
    render(<DownloadButton movie={movie} />);
    fireEvent.click(await screen.findByText("Verfügbar machen"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Version nicht mehr verfügbar"),
    );
    expect(await screen.findByText("Nur Englisch")).toBeTruthy();
    expect(loadMovieCandidates).toHaveBeenCalledTimes(2);
  });

  it("a ready click requests the version and then opens the link", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    loadMovieCandidates.mockResolvedValue([readyFile]);
    requestMovie.mockResolvedValue({
      ok: true,
      status: 200,
      outcome: "ready",
      nzbFileId: ownFile.nzbFileId,
    });
    getLink.mockResolvedValue("https://s3.example/matrix.mkv");
    render(<DownloadButton movie={movie} />);
    fireEvent.click(await screen.findByText("Herunterladen"));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        "https://s3.example/matrix.mkv",
        "_blank",
        "noopener,noreferrer",
      ),
    );
    expect(requestMovie).toHaveBeenCalledWith({ tmdbId: 603, key: ownFile.key });
    expect(getLink).toHaveBeenCalledWith(ownFile.nzbFileId);
    open.mockRestore();
  });

  it("shows 'Bereit' on a ready row", async () => {
    loadMovieCandidates.mockResolvedValue([readyFile]);
    render(<DownloadButton movie={movie} />);
    await openList();
    expect(await screen.findByText("Bereit")).toBeTruthy();
    expect(screen.getByText("Download")).toBeTruthy();
  });

  it("keeps the list with the Fehlerhaft group when every version is broken", async () => {
    loadMovieCandidates.mockResolvedValue([
      candidate({ ...ownFile, state: "broken", brokenReason: "Archiv unvollständig" }),
    ]);
    render(<DownloadButton movie={movie} hideWhenUnavailable />);
    expect(await screen.findByText("Keine Version gefunden")).toBeTruthy();
    await openList();
    expect(await screen.findByText("Fehlerhaft")).toBeTruthy();
    expect(screen.getByText("Archiv unvollständig")).toBeTruthy();
  });

  it("shows gold 'Herunterladen' for a ready best candidate", async () => {
    loadMovieCandidates.mockResolvedValue([readyFile]);
    render(<DownloadButton movie={movie} />);
    const button = (await screen.findByText("Herunterladen")).closest("button");
    expect(button?.className).toContain("bg-cinema-gold");
    expect(button?.textContent).toContain("1080p");
  });
});
