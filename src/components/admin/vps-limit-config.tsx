"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIG_KEYS = {
  globalLimit: "globalLimit",
  maxUploadVps: "maxUploadVps",
} as const;

const DEFAULTS = {
  globalLimit: 10,
  maxUploadVps: 3,
};

export function VpsLimitConfig() {
  const [globalLimit, setGlobalLimit] = useState(DEFAULTS.globalLimit);
  const [maxUploadVps, setMaxUploadVps] = useState(DEFAULTS.maxUploadVps);
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

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/admin/config/entries/vps");
      if (!res.ok)
        throw new Error("VPS-Limits konnten nicht geladen werden.");
      const data = await res.json();
      const entries: { key: string; value: string }[] = data.entries || [];

      for (const entry of entries) {
        if (entry.key === CONFIG_KEYS.globalLimit) {
          const v = parseInt(entry.value, 10);
          if (!isNaN(v)) setGlobalLimit(v);
        } else if (entry.key === CONFIG_KEYS.maxUploadVps) {
          const v = parseInt(entry.value, 10);
          if (!isNaN(v)) setMaxUploadVps(v);
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    fetchConfig().finally(() => setLoading(false));
  }, [fetchConfig]);

  const downloadMax = Math.max(0, globalLimit - maxUploadVps);

  const validate = (): string | null => {
    if (globalLimit < 1) return "Globales Limit muss mindestens 1 sein.";
    if (maxUploadVps < 0) return "Upload-Maximum darf nicht negativ sein.";
    if (maxUploadVps > globalLimit)
      return "Upload-Maximum darf nicht groesser als das globale Limit sein.";
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
          key: CONFIG_KEYS.globalLimit,
          value: String(globalLimit),
        },
        {
          categoryName: "vps",
          key: CONFIG_KEYS.maxUploadVps,
          value: String(maxUploadVps),
        },
      ];

      for (const body of puts) {
        const res = await fetch("/api/backend/admin/config/entries", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Speichern fehlgeschlagen.");
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
        Lade VPS-Limits…
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
            onClick={() => setError(null)}
            className="ml-auto text-xs underline"
          >
            Schliessen
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="globalLimit">Globales VPS-Limit</Label>
          <Input
            id="globalLimit"
            type="number"
            min={1}
            value={globalLimit}
            onChange={(e) => setGlobalLimit(parseInt(e.target.value, 10) || 1)}
          />
          <p className="text-xs text-muted-foreground">
            Maximale Anzahl gleichzeitiger VPS (Hetzner-Limit: 10)
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maxUploadVps">Upload-Maximum</Label>
          <Input
            id="maxUploadVps"
            type="number"
            min={0}
            max={globalLimit}
            value={maxUploadVps}
            onChange={(e) =>
              setMaxUploadVps(parseInt(e.target.value, 10) || 0)
            }
          />
          <p className="text-xs text-muted-foreground">
            Maximale Upload-VPS (Rest steht fuer Downloads bereit)
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Download-Maximum (berechnet)</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
            {downloadMax}
          </div>
          <p className="text-xs text-muted-foreground">
            = Globales Limit minus Upload-Maximum
          </p>
        </div>
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
        {success && (
          <span className="text-sm text-green-600">Gespeichert!</span>
        )}
      </div>
    </div>
  );
}
