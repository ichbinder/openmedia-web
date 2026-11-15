import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextEpisode } from "@/lib/backend";
import { NextEpisodeOverlay } from "./next-episode-overlay";

function advanceSeconds(n: number) {
  for (let i = 0; i < n; i++) act(() => { vi.advanceTimersByTime(1000); });
}

const next: NextEpisode = {
  showTmdbId: 1, season: 1, episode: 2, titleDe: "Zwei", nzbFileId: "f", request: null,
};

describe("NextEpisodeOverlay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("zählt 10 s herunter und spielt genau einmal weiter", () => {
    const onPlayNext = vi.fn();
    render(<NextEpisodeOverlay phase="countdown" next={next} onPlayNext={onPlayNext} onCancel={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText("Nächste Folge in 10 s")).toBeTruthy();
    advanceSeconds(9);
    expect(onPlayNext).not.toHaveBeenCalled();
    advanceSeconds(5);
    expect(onPlayNext).toHaveBeenCalledTimes(1);
  });

  it("Abbrechen stoppt den Countdown", () => {
    const onPlayNext = vi.fn();
    const onCancel = vi.fn();
    render(<NextEpisodeOverlay phase="countdown" next={next} onPlayNext={onPlayNext} onCancel={onCancel} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByText("Abbrechen"));
    advanceSeconds(20);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPlayNext).not.toHaveBeenCalled();
  });

  it("Jetzt abspielen springt sofort", () => {
    const onPlayNext = vi.fn();
    render(<NextEpisodeOverlay phase="countdown" next={next} onPlayNext={onPlayNext} onCancel={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByText("Jetzt abspielen"));
    expect(onPlayNext).toHaveBeenCalledTimes(1);
  });

  it("Knopf spielt die nächste Folge", () => {
    const onPlayNext = vi.fn();
    render(<NextEpisodeOverlay phase="button" next={next} onPlayNext={onPlayNext} onCancel={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByText("Nächste Folge ▶"));
    expect(onPlayNext).toHaveBeenCalledTimes(1);
  });

  it("Download-Klick fordert an und zeigt Wird gesucht…", () => {
    const onDownload = vi.fn();
    render(<NextEpisodeOverlay phase="download" next={{ ...next, nzbFileId: null }} onPlayNext={vi.fn()} onCancel={vi.fn()} onDownload={onDownload} />);
    fireEvent.click(screen.getByText("Nächste Folge herunterladen"));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Wird gesucht…")).toBeTruthy();
  });

  it("zeigt bei offener Anfrage den Status statt des Knopfs", () => {
    render(<NextEpisodeOverlay phase="download" next={{ ...next, nzbFileId: null, request: { status: "downloading", waitReason: null } }} onPlayNext={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText("Wird geladen…")).toBeTruthy();
    expect(screen.queryByText("Nächste Folge herunterladen")).toBeNull();
  });
});
