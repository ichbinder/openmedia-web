import { useEffect, useState } from "react";
import type { NextEpisode } from "@/lib/backend";
import { PROGRESS, type NextPhase } from "@/lib/progress";

interface NextEpisodeOverlayProps {
  phase: NextPhase;
  next: NextEpisode;
  onPlayNext: () => void;
  onCancel: () => void;
  onDownload: () => void;
}

const primaryClass =
  "rounded-md bg-cinema-gold px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90";
const secondaryClass =
  "rounded-md bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25";

function requestNote(request: NonNullable<NextEpisode["request"]>) {
  return request.status === "downloading" ? "Wird geladen…" : "Wird gesucht…";
}

function Countdown({
  onPlayNext,
  onCancel,
}: Pick<NextEpisodeOverlayProps, "onPlayNext" | "onCancel">) {
  const [left, setLeft] = useState<number>(PROGRESS.COUNTDOWN_SEC);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (cancelled) return;
    if (left <= 0) {
      onPlayNext();
      return;
    }
    const timer = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, cancelled, onPlayNext]);

  if (cancelled) return null;
  return (
    <>
      <p className="text-sm font-medium">Nächste Folge in {left} s</p>
      <div className="flex gap-2">
        <button onClick={onPlayNext} className={primaryClass}>
          Jetzt abspielen
        </button>
        <button
          onClick={() => {
            setCancelled(true);
            onCancel();
          }}
          className={secondaryClass}
        >
          Abbrechen
        </button>
      </div>
    </>
  );
}

export function NextEpisodeOverlay({
  phase,
  next,
  onPlayNext,
  onCancel,
  onDownload,
}: NextEpisodeOverlayProps) {
  const [requested, setRequested] = useState(false);
  if (phase === "hidden") return null;

  return (
    <div className="absolute bottom-20 right-4 z-40 flex flex-col items-end gap-2 rounded-lg bg-black/70 p-3 text-white">
      {phase === "countdown" && <Countdown onPlayNext={onPlayNext} onCancel={onCancel} />}
      {phase === "button" && (
        <button onClick={onPlayNext} className={primaryClass}>
          Nächste Folge ▶
        </button>
      )}
      {phase === "download" &&
        (next.request || requested ? (
          <p className="text-sm">{next.request ? requestNote(next.request) : "Wird gesucht…"}</p>
        ) : (
          <button
            onClick={() => {
              setRequested(true);
              onDownload();
            }}
            className={primaryClass}
          >
            Nächste Folge herunterladen
          </button>
        ))}
    </div>
  );
}
