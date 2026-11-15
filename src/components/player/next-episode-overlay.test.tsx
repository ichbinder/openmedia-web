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

  it("Download-Klick fordert an und zeigt Wird gesucht…", async () => {
    const onDownload = vi.fn();
    render(<NextEpisodeOverlay phase="download" next={{ ...next, nzbFileId: null }} onPlayNext={vi.fn()} onCancel={vi.fn()} onDownload={onDownload} />);
    await act(async () => { fireEvent.click(screen.getByText("Nächste Folge herunterladen")); });
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Wird gesucht…")).toBeTruthy();
  });

  it("zeigt bei fehlgeschlagener Anfrage einen Fehler und behält den Knopf", async () => {
    const onDownload = vi.fn().mockResolvedValue(false);
    render(<NextEpisodeOverlay phase="download" next={{ ...next, nzbFileId: null }} onPlayNext={vi.fn()} onCancel={vi.fn()} onDownload={onDownload} />);
    await act(async () => { fireEvent.click(screen.getByText("Nächste Folge herunterladen")); });
    expect(screen.getByText("Anfrage fehlgeschlagen")).toBeTruthy();
    expect(screen.getByText("Nächste Folge herunterladen")).toBeTruthy();
    expect(screen.queryByText("Wird gesucht…")).toBeNull();
  });

  it("Countdown überlebt Re-Renders mit neuer onPlayNext-Identität", () => {
    const calls = vi.fn();
    const ui = () => (
      <NextEpisodeOverlay phase="countdown" next={next} onPlayNext={() => calls()} onCancel={vi.fn()} onDownload={vi.fn()} />
    );
    const { rerender } = render(ui());
    for (let i = 0; i < 10; i++) {
      advanceSeconds(1);
      rerender(ui());
    }
    advanceSeconds(3);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("ruft bei fehlgeschlagenem Start nur einmal auf und zeigt Fehler mit Knopf", async () => {
    const onPlayNext = vi.fn().mockResolvedValue(false);
    render(<NextEpisodeOverlay phase="countdown" next={next} onPlayNext={onPlayNext} onCancel={vi.fn()} onDownload={vi.fn()} />);
    advanceSeconds(10);
    await act(async () => { await Promise.resolve(); });
    advanceSeconds(5);
    expect(onPlayNext).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Nächste Folge konnte nicht gestartet werden")).toBeTruthy();
    expect(screen.getByText("Nächste Folge ▶")).toBeTruthy();
  });

  it("zeigt bei offener Anfrage den Status statt des Knopfs", () => {
    render(<NextEpisodeOverlay phase="download" next={{ ...next, nzbFileId: null, request: { status: "downloading", waitReason: null } }} onPlayNext={vi.fn()} onCancel={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText("Wird geladen…")).toBeTruthy();
    expect(screen.queryByText("Nächste Folge herunterladen")).toBeNull();
  });
});
