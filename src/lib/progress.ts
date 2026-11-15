import type { Resume } from "./backend";

export const PROGRESS = {
  REPORT_INTERVAL_SEC: 30,
  SEEK_SETTLE_MS: 2000,
  RESUME_MIN_SEC: 60,
  NEXT_BUTTON_SEC: 60,
  COUNTDOWN_SEC: 10,
} as const;

export function shouldAskResume(resume: Resume | null): boolean {
  return resume !== null && !resume.finished && resume.positionSec > PROGRESS.RESUME_MIN_SEC;
}

export function formatTimestamp(sec: number): string {
  const total = Math.floor(sec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}
