import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgressReporter } from "./progress-reporter";

describe("createProgressReporter", () => {
  const send = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    send.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("meldet beim Spielen alle 30 s", () => {
    const reporter = createProgressReporter(send, "f1");
    for (let s = 1; s <= 65; s++) {
      vi.advanceTimersByTime(1000);
      reporter.tick(s, 6000, true);
    }
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, { nzbFileId: "f1", positionSec: 30, durationSec: 6000 }, false);
    expect(send).toHaveBeenNthCalledWith(2, { nzbFileId: "f1", positionSec: 60, durationSec: 6000 }, false);
  });

  it("meldet bei Pause und Ende sofort", () => {
    const reporter = createProgressReporter(send, "f1");
    reporter.pause(100, 6000);
    reporter.ended(6000, 6000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("meldet nach Spulen erst nach 2 s Ruhe, einmal", () => {
    const reporter = createProgressReporter(send, "f1");
    for (let i = 0; i < 5; i++) {
      reporter.seeked(100 + i * 10, 6000);
      vi.advanceTimersByTime(200);
    }
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ nzbFileId: "f1", positionSec: 140, durationSec: 6000 }, false);
  });

  it("flush(true) sendet per Beacon die letzte Stelle", () => {
    const reporter = createProgressReporter(send, "f1");
    reporter.tick(12, 6000, true);
    reporter.flush(true);
    expect(send).toHaveBeenCalledWith({ nzbFileId: "f1", positionSec: 12, durationSec: 6000 }, true);
  });

  it("meldet nie ohne bekannte Länge", () => {
    const reporter = createProgressReporter(send, "f1");
    vi.advanceTimersByTime(60000);
    reporter.tick(10, NaN, true);
    reporter.tick(10, 0, true);
    reporter.pause(10, 0);
    reporter.flush(true);
    expect(send).not.toHaveBeenCalled();
  });

  it("dispose bricht ausstehendes Spul-Melden ab", () => {
    const reporter = createProgressReporter(send, "f1");
    reporter.seeked(100, 6000);
    reporter.dispose();
    vi.advanceTimersByTime(5000);
    expect(send).not.toHaveBeenCalled();
  });
});
