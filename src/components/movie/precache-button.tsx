"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { backendFetch } from "@/lib/backend";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getToken } from "@/lib/auth";
import { Download, Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";

// ── Types ──────────────────────────────────────────────────

type PrecacheState = "idle" | "queued" | "downloading" | "done" | "failed";

interface PrecacheStatus {
  state: PrecacheState;
  reason?: string | null;
  lastEventAt: string | null;
  bytesDownloaded?: number | string | null;
  sizeBytes?: number | string | null;
}

interface PrecacheButtonProps {
  movieHash: string;
}

// ── Helpers ────────────────────────────────────────────────

function formatElapsed(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "weniger als 1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function computeVariant(
  state: PrecacheState,
): "default" | "outline" | "secondary" | "destructive" {
  switch (state) {
    case "idle":
      return "default";
    case "queued":
      return "secondary";
    case "downloading":
      return "secondary";
    case "done":
      return "outline";
    case "failed":
      return "destructive";
  }
}

// ── Component ──────────────────────────────────────────────

export function PrecacheButton({ movieHash }: PrecacheButtonProps) {
  const [state, setState] = useState<PrecacheState>("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [bytesDownloaded, setBytesDownloaded] = useState<number | null>(null);
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch current state ───────────────────────────────

  const fetchState = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const res = await backendFetch<PrecacheStatus>(
      `/jellyfin/precache/${movieHash}`,
      { token },
    );

    if (!res.ok || res.status === 404) {
      // 404 → idle (no row exists yet)
      setState("idle");
      setReason(null);
      setLastEventAt(null);
      setBytesDownloaded(null);
      setSizeBytes(null);
      return;
    }

    const data = res.data;
    let parsedState: PrecacheState = "idle";
    if (
      data.state === "queued" ||
      data.state === "downloading" ||
      data.state === "done" ||
      data.state === "failed"
    ) {
      parsedState = data.state;
    }

    setState(parsedState);
    setReason(data.reason ?? null);
    setLastEventAt(data.lastEventAt ?? null);
    setBytesDownloaded(
      typeof data.bytesDownloaded === "string"
        ? Number(data.bytesDownloaded)
        : (data.bytesDownloaded ?? null),
    );
    setSizeBytes(
      typeof data.sizeBytes === "string"
        ? Number(data.sizeBytes)
        : (data.sizeBytes ?? null),
    );
  }, [movieHash]);

  // ── Initial fetch ─────────────────────────────────────

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // ── Polling: active when queued or downloading ────────

  useEffect(() => {
    // Clear existing poll
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (state === "queued" || state === "downloading") {
      pollRef.current = setInterval(fetchState, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state, fetchState]);

  // ── Click handler ─────────────────────────────────────

  async function handleClick() {
    const token = getToken();
    if (!token || isLoading) return;

    setIsLoading(true);
    try {
      const res = await backendFetch<PrecacheStatus>(
        `/jellyfin/precache/${movieHash}`,
        { method: "POST", token },
      );

      if (res.ok) {
        // Optimistic update
        setState("queued");
        setReason(null);
        setLastEventAt(new Date().toISOString());
      } else {
        // Refresh state on error
        await fetchState();
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ── Progress percentage ───────────────────────────────

  const progressPct =
    state === "downloading" &&
    bytesDownloaded != null &&
    sizeBytes != null &&
    sizeBytes > 0
      ? Math.floor((bytesDownloaded / sizeBytes) * 100)
      : null;

  // ── Render ────────────────────────────────────────────

  const variant = computeVariant(state);

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant={variant}
        size="sm"
        onClick={handleClick}
        disabled={
          state === "queued" ||
          state === "downloading" ||
          state === "done" ||
          isLoading
        }
        data-precache-state={state}
      >
        {state === "idle" && (
          <>
            <Download className="size-3.5" />
            Für heute Abend laden
          </>
        )}
        {state === "queued" && (
          <>
            <Clock className="size-3.5 animate-pulse" />
            Wartet auf Server… (seit {formatElapsed(lastEventAt)})
          </>
        )}
        {state === "downloading" && (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            {progressPct !== null ? `${progressPct}% geladen` : "Wird geladen…"}
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle className="size-3.5" />
            Auf Server bereit
          </>
        )}
        {state === "failed" && (
          <>
            <AlertCircle className="size-3.5" />
            Erneut versuchen
          </>
        )}
      </Button>

      {state === "failed" && reason && (
        <Badge variant="destructive" title={reason}>
          Fehler
        </Badge>
      )}

      {state === "done" && (
        <Badge variant="secondary">
          Bereit
        </Badge>
      )}
    </div>
  );
}
