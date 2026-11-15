interface WatchProgressProps {
  positionSec: number;
  durationSec: number;
}

export function WatchProgress({ positionSec, durationSec }: WatchProgressProps) {
  if (durationSec <= 0) return null;
  const percent = Math.min(100, Math.round((positionSec / durationSec) * 100));
  return (
    <div
      role="progressbar"
      aria-label="Fortschritt"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1 w-full overflow-hidden bg-white/20"
    >
      <div className="h-full bg-cinema-gold" style={{ width: `${percent}%` }} />
    </div>
  );
}
