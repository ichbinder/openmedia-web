import { formatTimestamp } from "@/lib/progress";

interface ResumePromptProps {
  positionSec: number;
  onResume: () => void;
  onRestart: () => void;
}

export function ResumePrompt({ positionSec, onResume, onRestart }: ResumePromptProps) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/70 text-white">
      <p className="text-lg font-medium">Weiterschauen ab {formatTimestamp(positionSec)}?</p>
      <div className="flex gap-3">
        <button
          onClick={onResume}
          className="rounded-md bg-cinema-gold px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Fortsetzen
        </button>
        <button
          onClick={onRestart}
          className="rounded-md bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25"
        >
          Von vorne
        </button>
      </div>
    </div>
  );
}
