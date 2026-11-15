"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Person } from "@/lib/backend";
import { LIMITS } from "@/lib/rating";

const MAX_LIMITS_TEXT_LENGTH = 500;

export interface LimitEdit {
  id: string;
  limits: string[];
  limitsText: string;
}

interface LimitsStepProps {
  persons: Person[];
  onSave: (edits: LimitEdit[]) => Promise<string | null>;
}

export function LimitsStep({ persons, onSave }: LimitsStepProps) {
  const [edits, setEdits] = useState<LimitEdit[]>(() =>
    persons.map(({ id, limits, limitsText }) => ({ id, limits, limitsText })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(id: string, patch: Partial<LimitEdit>) {
    setEdits((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function toggle(edit: LimitEdit, key: string) {
    const limits = edit.limits.includes(key)
      ? edit.limits.filter((l) => l !== key)
      : [...edit.limits, key];
    update(edit.id, { limits });
  }

  async function save() {
    setBusy(true);
    setMessage((await onSave(edits)) ?? "Gespeichert.");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {persons.map((person) => {
        const edit = edits.find((e) => e.id === person.id);
        if (!edit) return null;
        return (
        <fieldset key={person.id} className="space-y-2 rounded-md border border-border p-4">
          <legend className="px-1 font-medium">{person.name}</legend>
          {LIMITS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.limits.includes(key)}
                onChange={() => toggle(edit, key)}
              />
              {label}
            </label>
          ))}
          <Textarea
            aria-label={`Weitere Grenzen für ${person.name}`}
            placeholder="Weitere Grenzen"
            value={edit.limitsText}
            maxLength={MAX_LIMITS_TEXT_LENGTH}
            onChange={(e) => update(person.id, { limitsText: e.target.value })}
          />
        </fieldset>
        );
      })}
      <div className="flex items-center gap-2">
        <Button type="button" disabled={busy} onClick={save}>
          Speichern
        </Button>
        {message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
