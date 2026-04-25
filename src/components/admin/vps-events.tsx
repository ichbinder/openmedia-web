"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VpsEvent {
  id: string;
  jobType: string;
  eventType: string;
  severity: string;
  details: Record<string, unknown>;
  createdAt: string;
  downloadJob?: { id: string; status: string; hetznerServerId: number | null } | null;
  uploadJob?: { id: string; status: string; hetznerServerId: number | null } | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  routing_anomaly: "Routing-Anomalie",
  vpn_down: "VPN Down",
  vpn_reconnect: "VPN Reconnect",
  watchdog: "Watchdog",
  bootstrap: "Bootstrap",
};

export function VpsEvents() {
  const [events, setEvents] = useState<VpsEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      if (jobTypeFilter !== "all") params.set("jobType", jobTypeFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);

      const res = await fetch(`/api/backend/admin/config/vps-events?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [page, jobTypeFilter, severityFilter]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const totalPages = Math.ceil(total / limit);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">VPS Events</h3>
        <Button variant="ghost" size="sm" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={jobTypeFilter} onValueChange={(v) => { setJobTypeFilter(v ?? "all"); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Job-Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Jobs</SelectItem>
            <SelectItem value="download">Download</SelectItem>
            <SelectItem value="upload">Upload</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v ?? "all"); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {events.length === 0 && !error ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Keine Events vorhanden.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const job = event.downloadJob ?? event.uploadJob;
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
              >
                <Badge
                  variant="outline"
                  className={SEVERITY_STYLES[event.severity] ?? ""}
                >
                  {event.severity}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {event.jobType === "download" ? "⬇ Download" : "⬆ Upload"}
                    </span>
                    {job && (
                      <span className="text-xs text-muted-foreground">
                        · {job.status}
                        {job.hetznerServerId ? ` · Server #${job.hetznerServerId}` : ""}
                      </span>
                    )}
                  </div>
                  <pre className="mt-1 max-h-24 overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString("de-DE")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} Events</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Zurück
            </Button>
            <span className="flex items-center px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
