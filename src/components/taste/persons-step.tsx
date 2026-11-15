"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Person } from "@/lib/backend";

export const MAX_PERSONS = 6;
const MAX_NAME_LENGTH = 40;

export interface PersonDraft {
  id?: string;
  name: string;
}

function draftsOf(persons: Person[]): PersonDraft[] {
  return persons.length > 0 ? persons.map(({ id, name }) => ({ id, name })) : [{ name: "" }];
}

interface PersonsStepProps {
  persons: Person[];
  onSave: (drafts: PersonDraft[]) => Promise<string | null>;
}

export function PersonsStep({ persons, onSave }: PersonsStepProps) {
  const [rows, setRows] = useState<PersonDraft[]>(() => draftsOf(persons));
  const [seen, setSeen] = useState(persons);
  if (seen !== persons) {
    setSeen(persons);
    setRows(draftsOf(persons));
  }
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function rename(index: number, name: string) {
    setRows((cur) => cur.map((row, i) => (i === index ? { ...row, name } : row)));
  }

  async function save() {
    const drafts = rows
      .map((row) => ({ ...row, name: row.name.trim() }))
      .filter((row) => row.name.length > 0);
    if (drafts.length === 0) {
      setMessage("Mindestens eine Person ist nötig.");
      return;
    }
    setBusy(true);
    setMessage(await onSave(drafts) ?? "Gespeichert.");
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id ?? index} className="flex gap-2">
          <Input
            aria-label={`Name ${index + 1}`}
            value={row.name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => rename(index, e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Person ${index + 1} entfernen`}
            disabled={rows.length === 1}
            onClick={() => setRows((cur) => cur.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={rows.length >= MAX_PERSONS}
          onClick={() => setRows((cur) => [...cur, { name: "" }])}
        >
          <Plus className="size-4" />
          Person hinzufügen
        </Button>
        <Button type="button" disabled={busy} onClick={save}>
          Speichern
        </Button>
        {message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
