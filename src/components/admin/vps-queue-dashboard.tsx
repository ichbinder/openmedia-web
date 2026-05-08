"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle, RefreshCw, Server, Upload, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface VpsStatus {
  counts: { downloads: number; uploads: number; total: number };
  limits: { globalLimit: number; maxUploadVps: number };
  queued: { downloads: number; uploads: number; total: number };
}

export function VpsQueueDashboard() {
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<VpsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchStatus = useCallback(async (withLoading = false) => {
    if (withLoading) setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/backend/admin/config/vps-status", {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("VPS-Status konnte nicht geladen werden.");
      const data = await res.json();
      // Runtime validation: ensure expected shape exists
      if (!data?.counts || !data?.limits || !data?.queued) {
        throw new Error("Ungültiges API-Response-Format");
      }
      setStatus(data as VpsStatus);
      setError(null);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      if (withLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(true);
    // Auto-refresh every 30s
    intervalRef.current = setInterval(() => fetchStatus(), 30000);
    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Lade VPS-Status…
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        {error}
        <button
          onClick={() => {
            setError(null);
            fetchStatus(true);
          }}
          className="ml-auto text-xs underline"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!status) return null;

  const { counts, limits, queued } = status;
  const downloadMax = Math.max(0, limits.globalLimit - limits.maxUploadVps);
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const globalPercent = clamp(limits.globalLimit > 0 ? (counts.total / limits.globalLimit) * 100 : 0);
  const downloadPercent = clamp(downloadMax > 0 ? (counts.downloads / downloadMax) * 100 : 0);
  const uploadPercent = clamp(limits.maxUploadVps > 0 ? (counts.uploads / limits.maxUploadVps) * 100 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">VPS-Status</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchStatus()}
          className="gap-1.5"
        >
          <RefreshCw className="size-3.5" />
          Aktualisieren
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-400">
          <AlertCircle className="size-3.5 shrink-0" />
          Aktualisierung fehlgeschlagen — zeige letzten bekannten Stand
        </div>
      )}

      {/* Global usage bar */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Server className="size-4 text-muted-foreground" />
            Gesamt-Auslastung
          </span>
          <span className="tabular-nums">
            {counts.total} / {limits.globalLimit} VPS
          </span>
        </div>
        <Progress value={globalPercent} className="h-2" />
      </div>

      {/* Download + Upload cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Download className="size-4 text-blue-400" />
              Downloads
            </span>
            <span className="tabular-nums">
              {counts.downloads} / {downloadMax}
            </span>
          </div>
          <Progress value={downloadPercent} className="mb-3 h-1.5" />
          {queued.downloads > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {queued.downloads} wartend
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Upload className="size-4 text-green-400" />
              Uploads
            </span>
            <span className="tabular-nums">
              {counts.uploads} / {limits.maxUploadVps}
            </span>
          </div>
          <Progress value={uploadPercent} className="mb-3 h-1.5" />
          {queued.uploads > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {queued.uploads} wartend
            </div>
          )}
        </div>
      </div>

      {/* Queue summary when jobs are waiting */}
      {queued.total > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400">
          <Clock className="size-4 shrink-0" />
          {queued.total} Job{queued.total !== 1 ? "s" : ""} in der Warteschlange — werden automatisch gestartet wenn VPS-Slots frei werden
        </div>
      )}
    </div>
  );
}
