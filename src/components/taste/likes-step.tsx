"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GENRES } from "@/lib/rating";
import { cn } from "@/lib/utils";

const MAX_LIKES_LENGTH = 2000;

interface LikesStepProps {
  genres: string[];
  likesText: string;
  onSave: (genres: string[], likesText: string) => Promise<string | null>;
}

export function LikesStep({ genres, likesText, onSave }: LikesStepProps) {
  const [selected, setSelected] = useState(genres);
  const [text, setText] = useState(likesText);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(key: string) {
    setSelected((cur) => (cur.includes(key) ? cur.filter((g) => g !== key) : [...cur, key]));
  }

  async function save() {
    setBusy(true);
    setMessage((await onSave(selected, text)) ?? "Gespeichert.");
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {GENRES.map(({ key, label }) => {
          const pressed = selected.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(key)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                pressed ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <label className="block text-sm font-medium" htmlFor="likes-text">
        Was schaut ihr gern?
      </label>
      <Textarea
        id="likes-text"
        value={text}
        maxLength={MAX_LIKES_LENGTH}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button type="button" disabled={busy} onClick={save}>
          Speichern
        </Button>
        {message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
