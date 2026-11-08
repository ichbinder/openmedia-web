import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { EpisodeCandidates } from "./episode-candidates";

vi.mock("@/lib/auth", () => ({ getToken: vi.fn(() => "tok") }));
vi.mock("@/lib/backend", () => ({
  getReleaseCandidates: vi.fn(),
  requestEpisodes: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { getReleaseCandidates, requestEpisodes } from "@/lib/backend";
const mockCandidates = vi.mocked(getReleaseCandidates);
const mockRequest = vi.mocked(requestEpisodes);

const candidate = (over: object = {}) => ({
  guid: "g1",
  title: "t",
  qualityTier: "1080p",
  sizeBytes: 3010000000,
  gbPerHour: 3,
  inTargetBand: true,
  germanSubtitles: false,
  audioDescription: false,
  releaseType: "WEB-DL" as string | null,
  languageSource: "tag",
  ...over,
});

const listing = (candidates: unknown[]) =>
  mockCandidates.mockResolvedValue({ ok: true, status: 200, data: { candidates } } as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EpisodeCandidates", () => {
  it("shows the row label, size and Empfohlen on the first entry", async () => {
    listing([candidate(), candidate({ guid: "g2", qualityTier: "720p", releaseType: null, sizeBytes: 2600000000 })]);
    render(<EpisodeCandidates tmdbId={1} season={1} episode={2} onRequested={vi.fn()} />);
    expect(screen.getByText("Versionen werden gesucht…")).toBeTruthy();
    expect(await screen.findByText("1080p · WEB-DL · 3 GB")).toBeTruthy();
    expect(screen.getByText("720p · 2,6 GB")).toBeTruthy();
    expect(screen.getAllByText("Empfohlen")).toHaveLength(1);
    expect(mockCandidates).toHaveBeenCalledWith(1, 1, 2, "tok");
  });

  it("shows flag badges", async () => {
    listing([candidate({ germanSubtitles: true, audioDescription: true, languageSource: "name" })]);
    render(<EpisodeCandidates tmdbId={1} season={1} episode={2} onRequested={vi.fn()} />);
    expect(await screen.findByText("DE-Untertitel")).toBeTruthy();
    expect(screen.getByText("Hörfilm")).toBeTruthy();
    expect(screen.getByText("Sprache nur laut Name")).toBeTruthy();
  });

  it("sends the guid and reports the episode view", async () => {
    listing([candidate(), candidate({ guid: "g2" })]);
    const view = { season: 1, episode: 2, status: "downloading", waitReason: null };
    mockRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: { requests: [{ ...view, episode: 1 }, view] },
    } as never);
    const onRequested = vi.fn();
    render(<EpisodeCandidates tmdbId={7} season={1} episode={2} onRequested={onRequested} />);
    fireEvent.click((await screen.findAllByText("Diese laden"))[1]);
    await waitFor(() => expect(onRequested).toHaveBeenCalledWith(view));
    expect(mockRequest).toHaveBeenCalledWith(
      { tmdbId: 7, season: 1, episode: 2, guid: "g2" },
      "tok",
    );
    expect(toast.success).toHaveBeenCalledWith("Version angefordert");
  });

  it("says the version is already available when the request comes back done", async () => {
    listing([candidate()]);
    const view = { season: 1, episode: 2, status: "done", waitReason: null };
    mockRequest.mockResolvedValue({ ok: true, status: 200, data: { requests: [view] } } as never);
    const onRequested = vi.fn();
    render(<EpisodeCandidates tmdbId={7} season={1} episode={2} onRequested={onRequested} />);
    fireEvent.click(await screen.findByText("Diese laden"));
    await waitFor(() => expect(onRequested).toHaveBeenCalledWith(view));
    expect(toast.success).toHaveBeenCalledWith("Version ist schon verfügbar");
    expect(toast.success).not.toHaveBeenCalledWith("Version angefordert");
  });

  it("toasts when TMDB does not know the episode", async () => {
    listing([candidate()]);
    mockRequest.mockResolvedValue({ ok: true, status: 200, data: { requests: [] } } as never);
    render(<EpisodeCandidates tmdbId={7} season={1} episode={2} onRequested={vi.fn()} />);
    fireEvent.click(await screen.findByText("Diese laden"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Folge bei TMDB nicht gefunden"));
  });

  it("toasts the error text when requesting fails", async () => {
    listing([candidate()]);
    mockRequest.mockResolvedValue({ ok: false, status: 502, data: { error: "Boom" } } as never);
    render(<EpisodeCandidates tmdbId={7} season={1} episode={2} onRequested={vi.fn()} />);
    fireEvent.click(await screen.findByText("Diese laden"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Boom"));
  });

  it("shows a hint for an empty list", async () => {
    listing([]);
    render(<EpisodeCandidates tmdbId={1} season={1} episode={2} onRequested={vi.fn()} />);
    expect(await screen.findByText("Keine deutsche Version gefunden")).toBeTruthy();
  });

  it("shows the response error for 503/502", async () => {
    mockCandidates.mockResolvedValue({ ok: false, status: 503, data: { error: "Indexer down" } } as never);
    render(<EpisodeCandidates tmdbId={1} season={1} episode={2} onRequested={vi.fn()} />);
    expect(await screen.findByText("Indexer down")).toBeTruthy();
  });
});
