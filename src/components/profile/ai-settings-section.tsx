"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken } from "@/lib/auth";
import { formatRunTime } from "@/lib/format-run-time";
import {
  getAiSettings,
  putAiSettings,
  refreshSuggestions,
  testAiSettings,
  type AiSettingsView,
} from "@/lib/backend";

const MODEL_PLACEHOLDER = "moonshotai/kimi-k3";
function runStatusLine(lastRun: AiSettingsView["lastRun"]): string | null {
  if (!lastRun) return null;
  if (lastRun.status === "running") return "Lauf läuft …";
  const when = lastRun.finishedAt ? formatRunTime(lastRun.finishedAt) : "";
  if (lastRun.status === "failed") return `Letzter Lauf: ${when} fehlgeschlagen: ${lastRun.error ?? "unbekannter Fehler"}`;
  return `Letzter Lauf: ${when} ✓`;
}

export function AiSettingsSection() {
  const [settings, setSettings] = useState<AiSettingsView | null>(null);
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [changingKey, setChangingKey] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await getAiSettings(token);
    if (!res.ok || !res.data) {
      setMessage({ text: "Einstellungen konnten nicht geladen werden.", error: true });
      return;
    }
    setSettings(res.data);
    setModel(res.data.model || MODEL_PLACEHOLDER);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; setState runs after await, the rule cannot tell
    void load();
  }, [load]);

  async function run(action: () => Promise<{ text: string; error: boolean }>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch {
      setMessage({ text: "Anfrage fehlgeschlagen.", error: true });
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      const token = getToken();
      if (!token) return { text: "Nicht angemeldet.", error: true };
      const body = apiKey.trim() ? { model: model.trim(), apiKey: apiKey.trim() } : { model: model.trim() };
      const res = await putAiSettings(body, token);
      if (!res.ok) return { text: (res.data as { error?: string } | null)?.error ?? "Speichern fehlgeschlagen.", error: true };
      setApiKey("");
      setChangingKey(false);
      await load();
      return { text: "Gespeichert.", error: false };
    });

  const testConnection = () =>
    run(async () => {
      const token = getToken();
      if (!token) return { text: "Nicht angemeldet.", error: true };
      const res = await testAiSettings(token);
      if (res.ok && res.data?.ok) return { text: "Verbindung klappt ✓", error: false };
      return { text: res.data?.error ?? "Verbindungstest fehlgeschlagen.", error: true };
    });

  const refresh = () =>
    run(async () => {
      const token = getToken();
      if (!token) return { text: "Nicht angemeldet.", error: true };
      const res = await refreshSuggestions(token);
      if (!res.ok) return { text: res.data?.error ?? "Lauf konnte nicht gestartet werden.", error: true };
      await load();
      return { text: "Lauf gestartet.", error: false };
    });

  if (!settings) return <div className="h-24 animate-pulse rounded-lg bg-muted" />;

  const showKeyInput = !settings.hasKey || changingKey;
  const statusLine = runStatusLine(settings.lastRun);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="ai-key">OpenRouter-Key</Label>
        {showKeyInput ? (
          <Input
            id="ai-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        ) : (
          <p className="text-sm">
            Key gespeichert{" "}
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setChangingKey(true)}>
              Ändern
            </button>
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-model">Modell</Label>
        <Input
          id="ai-model"
          placeholder={MODEL_PLACEHOLDER}
          maxLength={100}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={busy || !model.trim()}>
          Speichern
        </Button>
        <Button size="sm" variant="outline" onClick={testConnection} disabled={busy || !settings.hasKey}>
          Verbindung testen
        </Button>
        <Button size="sm" variant="outline" onClick={refresh} disabled={busy || !settings.hasKey}>
          Jetzt neu erstellen
        </Button>
      </div>
      {message && (
        <p className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message.text}</p>
      )}
      {statusLine && <p className="text-sm text-muted-foreground">{statusLine}</p>}
    </div>
  );
}
