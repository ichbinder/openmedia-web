import { PROGRESS } from "./progress";

export interface ProgressBody {
  nzbFileId: string;
  positionSec: number;
  durationSec: number;
}

export function createProgressReporter(
  send: (body: ProgressBody, beacon: boolean) => void,
  nzbFileId: string,
) {
  let latest: { positionSec: number; durationSec: number } | null = null;
  let lastSentAt = Date.now();
  let dirty = false;
  let seekTimer: ReturnType<typeof setTimeout> | undefined;

  function remember(positionSec: number, durationSec: number, markDirty: boolean) {
    if (!Number.isFinite(durationSec) || durationSec <= 0 || !Number.isFinite(positionSec)) return;
    latest = { positionSec, durationSec };
    dirty ||= markDirty;
  }

  function flush(beacon: boolean) {
    if (!latest || !dirty) return;
    dirty = false;
    lastSentAt = Date.now();
    send({ nzbFileId, ...latest }, beacon);
  }

  function reportNow(positionSec: number, durationSec: number) {
    clearTimeout(seekTimer);
    remember(positionSec, durationSec, true);
    flush(false);
  }

  return {
    tick(positionSec: number, durationSec: number, playing: boolean) {
      remember(positionSec, durationSec, playing);
      if (playing && Date.now() - lastSentAt >= PROGRESS.REPORT_INTERVAL_SEC * 1000) flush(false);
    },
    pause: reportNow,
    ended: reportNow,
    seeked(positionSec: number, durationSec: number) {
      remember(positionSec, durationSec, true);
      clearTimeout(seekTimer);
      seekTimer = setTimeout(() => flush(false), PROGRESS.SEEK_SETTLE_MS);
    },
    flush,
    dispose() {
      clearTimeout(seekTimer);
    },
  };
}
