import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackInfo, RatingView } from "@/lib/backend";

const media = {
  state: { duration: 100, paused: true, fullscreen: false, canPlay: false },
  currentTime: 0,
  play: vi.fn(),
  pause: vi.fn(),
};
let playerProps: { onEnded: () => void };

vi.mock("@vidstack/react", () => ({
  MediaPlayer: ({ ref, children, ...props }: { ref: React.Ref<unknown>; children: React.ReactNode; onEnded: () => void }) => {
    useImperativeHandle(ref, () => media);
    playerProps = props;
    return <div>{children}</div>;
  },
  MediaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Poster: () => null,
}));
vi.mock("@vidstack/react/player/layouts/default", () => ({ DefaultVideoLayout: () => null, defaultLayoutIcons: {} }));
vi.mock("@vidstack/react/player/styles/default/theme.css", () => ({}));
vi.mock("@vidstack/react/player/styles/default/layouts/video.css", () => ({}));
vi.mock("@/lib/auth", () => ({ getToken: () => "tok" }));
vi.mock("@/contexts/download-context", () => ({ useDownloads: () => ({ getStream: vi.fn() }) }));
vi.mock("@/hooks/use-persons", () => ({ usePersons: () => [] }));
vi.mock("@/lib/backend", () => ({
  getNextEpisode: vi.fn(),
  reportProgress: vi.fn(() => Promise.resolve()),
  requestEpisodes: vi.fn(),
  putRating: vi.fn(),
  deleteRating: vi.fn(),
}));
import { getNextEpisode, putRating } from "@/lib/backend";
import { VideoPlayer } from "./video-player";

const movie: PlaybackInfo = {
  next: null,
  seasonFinale: false,
  title: { kind: "movie", tmdbId: 7, name: "Heat" },
  rating: null,
};
const saved: RatingView = {
  kind: "show", tmdbId: 9, verdict: "up", tags: [], forWhom: null, source: "app", ratedAt: "2026-01-01",
};

async function renderPlayer(info: PlaybackInfo, onClose = vi.fn()) {
  vi.mocked(getNextEpisode).mockResolvedValue({ ok: true, status: 200, data: info });
  render(<VideoPlayer src="https://x/v.mp4" title="T" nzbFileId="f1" onClose={onClose} />);
  await waitFor(() => expect(getNextEpisode).toHaveBeenCalled());
  await act(async () => {});
  return onClose;
}

function closePlayer() {
  fireEvent.click(screen.getByRole("button", { name: "Player schließen" }));
}

beforeEach(() => {
  vi.mocked(getNextEpisode).mockReset();
  vi.mocked(putRating).mockReset().mockResolvedValue({ ok: true, status: 200, data: saved });
  media.currentTime = 0;
});

describe("VideoPlayer rating", () => {
  it("asks after a film ends", async () => {
    await renderPlayer(movie);
    expect(screen.queryByText(/Wie war/)).not.toBeInTheDocument();
    media.currentTime = 100;
    act(() => playerProps.onEnded());
    expect(screen.getByRole("dialog", { name: "Bewertung" })).toHaveTextContent("Wie war „Heat“?");
  });

  it("shows the panel instead of closing at 92 % and closes after Überspringen", async () => {
    const onClose = await renderPlayer(movie);
    media.currentTime = 92;
    closePlayer();
    expect(onClose).not.toHaveBeenCalled();
    expect(media.pause).toHaveBeenCalled();
    expect(screen.getByText(/Wie war/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(putRating).not.toHaveBeenCalled();
  });

  it("closes right away below 90 %", async () => {
    const onClose = await renderPlayer(movie);
    media.currentTime = 50;
    closePlayer();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not ask for a film that already has a verdict", async () => {
    const onClose = await renderPlayer({ ...movie, rating: { ...saved, kind: "movie", tmdbId: 7 } });
    media.currentTime = 95;
    closePlayer();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Wie war/)).not.toBeInTheDocument();
  });

  it("asks at most once per playback", async () => {
    const onClose = await renderPlayer(movie);
    media.currentTime = 100;
    act(() => playerProps.onEnded());
    fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
    act(() => playerProps.onEnded());
    expect(screen.queryByText(/Wie war/)).not.toBeInTheDocument();
    closePlayer();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the next-episode overlay only after Fertig on a season finale", async () => {
    await renderPlayer({
      next: { showTmdbId: 9, season: 2, episode: 1, titleDe: null, nzbFileId: "f2", request: null },
      seasonFinale: true,
      title: { kind: "show", tmdbId: 9, name: "Dark" },
      rating: null,
    });
    media.currentTime = 100;
    act(() => playerProps.onEnded());
    expect(screen.getByText("Wie war „Dark“?")).toBeInTheDocument();
    expect(screen.queryByText(/Nächste Folge in/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Super/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await waitFor(() => expect(screen.getByText(/Nächste Folge in/)).toBeInTheDocument());
    expect(screen.queryByText(/Wie war/)).not.toBeInTheDocument();
  });
});
