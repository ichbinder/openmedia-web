"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Person } from "@/lib/backend";
import { LIMITS } from "@/lib/rating";

const MAX_LIMITS_TEXT_LENGTH = 500;

interface LimitsStepProps {
  persons: Person[];
  onSave: (persons: Person[]) => Promise<string | null>;
}

export function LimitsStep({ persons, onSave }: LimitsStepProps) {
  const [drafts, setDrafts] = useState(persons);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(id: string, patch: Partial<Person>) {
    setDrafts((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function toggle(person: Person, key: string) {
    const limits = person.limits.includes(key)
      ? person.limits.filter((l) => l !== key)
      : [...person.limits, key];
    update(person.id, { limits });
  }

  async function save() {
    setBusy(true);
    setMessage((await onSave(drafts)) ?? "Gespeichert.");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {drafts.map((person) => (
        <fieldset key={person.id} className="space-y-2 rounded-md border border-border p-4">
          <legend className="px-1 font-medium">{person.name}</legend>
          {LIMITS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={person.limits.includes(key)}
                onChange={() => toggle(person, key)}
              />
              {label}
            </label>
          ))}
          <Textarea
            aria-label={`Weitere Grenzen für ${person.name}`}
            placeholder="Weitere Grenzen"
            value={person.limitsText}
            maxLength={MAX_LIMITS_TEXT_LENGTH}
            onChange={(e) => update(person.id, { limitsText: e.target.value })}
          />
        </fieldset>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" disabled={busy} onClick={save}>
          Speichern
        </Button>
        {message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
