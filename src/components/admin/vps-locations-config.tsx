"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle, Save, ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_LOCATIONS = ["hel1", "fsn1", "nbg1"];

const CONFIG_KEYS = {
  download: "downloadLocations",
  upload: "uploadLocations",
} as const;

interface HetznerLocation {
  id: number;
  name: string;
  description: string;
  country: string;
  city: string;
  network_zone: string;
}

interface SortableListProps {
  label: string;
  helpText: string;
  available: HetznerLocation[];
  selected: string[];
  onChange: (next: string[]) => void;
}

function describeLocation(name: string, available: HetznerLocation[]): string {
  const match = available.find((l) => l.name === name);
  if (!match) return name;
  const cityCountry = [match.city, match.country].filter(Boolean).join(", ");
  return cityCountry ? `${name} — ${cityCountry}` : name;
}

function SortableList({ label, helpText, available, selected, onChange }: SortableListProps) {
  const [pickerValue, setPickerValue] = useState<string>("");

  const move = (idx: number, delta: number) => {
    const next = [...selected];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(selected.filter((_, i) => i !== idx));
  };

  const add = () => {
    if (!pickerValue) return;
    if (selected.includes(pickerValue)) return;
    onChange([...selected, pickerValue]);
    setPickerValue("");
  };

  const remaining = available.filter((l) => !selected.includes(l.name));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{helpText}</p>

      <ol className="space-y-1.5 rounded-md border bg-muted/30 p-2">
        {selected.length === 0 ? (
          <li className="px-2 py-1.5 text-xs text-muted-foreground italic">
            Keine Locations ausgewaehlt — Default ({DEFAULT_LOCATIONS.join(", ")}) wird verwendet.
          </li>
        ) : (
          selected.map((name, idx) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <span className="w-5 text-xs tabular-nums text-muted-foreground">
                {idx + 1}.
              </span>
              <span className="flex-1 truncate">
                {describeLocation(name, available)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`${name} nach oben`}
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`${name} nach unten`}
                disabled={idx === selected.length - 1}
                onClick={() => move(idx, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-destructive"
                aria-label={`${name} entfernen`}
                onClick={() => remove(idx)}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))
        )}
      </ol>

      {remaining.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={pickerValue} onValueChange={(v) => setPickerValue(v ?? "")}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Location hinzufuegen…" />
            </SelectTrigger>
            <SelectContent>
              {remaining.map((l) => (
                <SelectItem key={l.name} value={l.name}>
                  {describeLocation(l.name, available)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            disabled={!pickerValue}
          >
            <Plus className="mr-1 size-4" />
            Hinzufuegen
          </Button>
        </div>
      )}
    </div>
  );
}

export function VpsLocationsConfig() {
  const [download, setDownload] = useState<string[]>(DEFAULT_LOCATIONS);
  const [upload, setUpload] = useState<string[]>(DEFAULT_LOCATIONS);
  const [available, setAvailable] = useState<HetznerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const parseList = (value: string | undefined): string[] | null => {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return null;
      const cleaned = parsed
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim());
      return cleaned.length > 0 ? cleaned : null;
    } catch {
      return null;
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Hetzner-Locations sind optional — bei Fehlschlag (HTTP oder Netzwerk)
      // weiter mit Default-Fallback. Daher allSettled, damit ein einziger
      // Netzwerkfehler im optionalen Fetch nicht den Pflicht-Fetch ausschliesst.
      const [entriesResult, locationsResult] = await Promise.allSettled([
        fetch("/api/backend/admin/config/entries/vps"),
        fetch("/api/backend/admin/config/hetzner-locations"),
      ]);

      if (entriesResult.status === "rejected" || !entriesResult.value.ok) {
        throw new Error("VPS-Locations konnten nicht geladen werden.");
      }

      const entriesData = await entriesResult.value.json();
      const entries: { key: string; value: string }[] = entriesData.entries || [];

      for (const entry of entries) {
        if (entry.key === CONFIG_KEYS.download) {
          const list = parseList(entry.value);
          if (list) setDownload(list);
        } else if (entry.key === CONFIG_KEYS.upload) {
          const list = parseList(entry.value);
          if (list) setUpload(list);
        }
      }

      if (locationsResult.status === "fulfilled" && locationsResult.value.ok) {
        const locationsData = await locationsResult.value.json();
        const list: HetznerLocation[] = Array.isArray(locationsData.locations)
          ? locationsData.locations
          : [];
        setAvailable(list);
      } else {
        // Fallback: minimale Liste damit man ueberhaupt was auswaehlen kann.
        setAvailable(
          DEFAULT_LOCATIONS.map((name, id) => ({
            id,
            name,
            description: name,
            country: "",
            city: "",
            network_zone: "",
          })),
        );
      }
    } catch (err) {
      setError((err as Error).message);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const validate = (): string | null => {
    if (download.length === 0)
      return "Mindestens eine Download-Location auswaehlen.";
    if (upload.length === 0)
      return "Mindestens eine Upload-Location auswaehlen.";
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const puts = [
        {
          categoryName: "vps",
          key: CONFIG_KEYS.download,
          value: JSON.stringify(download),
        },
        {
          categoryName: "vps",
          key: CONFIG_KEYS.upload,
          value: JSON.stringify(upload),
        },
      ];

      // Sequentiell speichern: wenn Download-PUT fehlschlaegt, wird der Upload-PUT
      // nicht abgesendet — verhindert halb-applied State (eine Liste alt, andere neu).
      for (let i = 0; i < puts.length; i++) {
        const body = puts[i];
        const res = await fetch("/api/backend/admin/config/entries", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const partial = i > 0 ? " (vorherige Aenderung wurde bereits gespeichert)" : "";
          throw new Error(
            (data.error || "Speichern fehlgeschlagen.") + partial,
          );
        }
      }

      setSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Lade VPS-Locations…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <button
            onClick={() => {
              setError(null);
              if (loadError) {
                setLoadError(false);
                fetchAll();
              }
            }}
            className="ml-auto text-xs underline"
          >
            {loadError ? "Erneut versuchen" : "Schliessen"}
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SortableList
          label="Download-VPS Locations"
          helpText="Reihenfolge = Prioritaet. Bei Kapazitaetsengpass wird die naechste Location probiert."
          available={available}
          selected={download}
          onChange={setDownload}
        />
        <SortableList
          label="Upload-VPS Locations"
          helpText="Eigene Liste fuer Upload-Server. Erste verfuegbare Location wird genutzt."
          available={available}
          selected={upload}
          onChange={setUpload}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || loadError}>
          {saving ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-4" />
          )}
          Speichern
        </Button>
        {success && <span className="text-sm text-green-600">Gespeichert!</span>}
      </div>
    </div>
  );
}
