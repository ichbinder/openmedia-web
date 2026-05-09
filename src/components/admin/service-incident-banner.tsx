"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ServiceIncident {
  id: string;
  service: string;
  operation: string | null;
  message: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `vor ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `vor ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `vor ${diffDay}d`;
}

export function ServiceIncidentBanner() {
  const [incidents, setIncidents] = useState<ServiceIncident[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/backend/admin/config/incidents", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.incidents && Array.isArray(data.incidents)) {
          setIncidents(data.incidents);
        }
      })
      .catch(() => {
        // Silent fail — Banner ist nur informativ
      });
    return () => controller.abort();
  }, []);

  if (incidents.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm"
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="size-4" />
        Service-Störung{incidents.length > 1 ? "en" : ""} aktiv
      </div>
      <ul className="space-y-1.5">
        {incidents.map((inc) => (
          <li key={inc.id} className="flex flex-wrap items-baseline gap-x-2 text-foreground">
            <span className="font-medium">{inc.service}</span>
            {inc.operation && (
              <span className="text-xs text-muted-foreground">({inc.operation})</span>
            )}
            <span className="text-muted-foreground">— {inc.message}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatRelative(inc.lastSeenAt)} · {inc.occurrences}×
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
