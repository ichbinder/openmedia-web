"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteRating, putRating, type Person, type RatingTitle, type RatingView, type Verdict } from "@/lib/backend";
import { getToken } from "@/lib/auth";
import { TAGS, VERDICTS } from "@/lib/rating";
import { cn } from "@/lib/utils";

const FAILED = "Das hat leider nicht geklappt.";

interface RatingPanelProps {
  title: RatingTitle;
  initial: RatingView | null;
  persons: Person[];
  mode: "prompt" | "detail";
  onDone: (saved: RatingView | null) => void;
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        pressed ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function RatingPanel({ title, initial, persons, mode, onDone }: RatingPanelProps) {
  const [verdict, setVerdict] = useState<Verdict | null>(initial?.verdict ?? null);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [forWhom, setForWhom] = useState<string | null>(initial?.forWhom ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(key: string) {
    setTags((cur) => (cur.includes(key) ? cur.filter((t) => t !== key) : [...cur, key]));
  }

  async function run(action: (token: string) => Promise<RatingView | null>) {
    const token = getToken();
    if (!token) {
      setError(FAILED);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await action(token));
    } catch {
      setError(FAILED);
      setBusy(false);
    }
  }

  async function save() {
    if (!verdict) return;
    await run(async (token) => {
      const res = await putRating(title.kind, title.tmdbId, { verdict, tags, forWhom }, token);
      if (!res.ok) throw new Error("save failed");
      return res.data;
    });
  }

  async function remove() {
    await run(async (token) => {
      const res = await deleteRating(title.kind, title.tmdbId, token);
      if (!res.ok && res.status !== 404) throw new Error("delete failed");
      return null;
    });
  }

  return (
    <div className="space-y-4 rounded-xl bg-black/80 p-5 text-white backdrop-blur">
      <h2 className="text-lg font-semibold">Wie war „{title.name}“?</h2>

      <div className="flex gap-2">
        {VERDICTS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={verdict === v.key}
            onClick={() => setVerdict(v.key)}
            className={cn(
              "flex flex-1 flex-col items-center rounded-lg border px-3 py-2 transition-colors",
              verdict === v.key ? "border-primary bg-primary/30" : "border-white/20 hover:bg-white/10",
            )}
          >
            <span className="text-2xl">{v.emoji}</span>
            <span className="text-xs">{v.label}</span>
          </button>
        ))}
      </div>

      {persons.length >= 2 && (
        <div>
          <p className="mb-1 text-sm text-white/70">Für wen?</p>
          <div className="flex flex-wrap gap-2">
            <Toggle pressed={forWhom === null} onClick={() => setForWhom(null)}>Beide</Toggle>
            {persons.map((p) => (
              <Toggle key={p.id} pressed={forWhom === p.id} onClick={() => setForWhom(p.id)}>
                {p.name}
              </Toggle>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <Toggle key={t.key} pressed={tags.includes(t.key)} onClick={() => toggleTag(t.key)}>
            {t.label}
          </Toggle>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={!verdict || busy}>Fertig</Button>
        {mode === "prompt" && (
          <Button variant="ghost" onClick={() => onDone(null)} disabled={busy}>Überspringen</Button>
        )}
        {mode === "detail" && initial && (
          <Button variant="destructive" onClick={remove} disabled={busy}>Bewertung löschen</Button>
        )}
      </div>
    </div>
  );
}
