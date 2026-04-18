"use client";

import { useState, useEffect } from "react";
import { History, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HistoryEntry {
  id: string;
  action: string;
  changedBy: string | null;
  createdAt: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actionLabel(action: string): string {
  switch (action) {
    case "created":
      return "Erstellt";
    case "updated":
      return "Aktualisiert";
    case "deleted":
      return "Gelöscht";
    default:
      return action;
  }
}

function actionColor(action: string): string {
  switch (action) {
    case "created":
      return "text-green-400";
    case "updated":
      return "text-amber-400";
    case "deleted":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

interface ConfigHistoryProps {
  categoryName: string;
  entryKey: string;
  onClose: () => void;
}

export function ConfigHistory({ categoryName, entryKey, onClose }: ConfigHistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/backend/admin/config/history/${encodeURIComponent(categoryName)}/${encodeURIComponent(entryKey)}`,
        );
        if (!res.ok) throw new Error("Historie konnte nicht geladen werden.");
        const data = await res.json();
        setEntries(data.history || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [categoryName, entryKey]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5" />
            Änderungsverlauf
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono">{categoryName}/{entryKey}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-4 text-center text-sm text-destructive">{error}</p>
          ) : entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Keine Änderungen gefunden.
            </p>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className={`text-sm font-medium ${actionColor(entry.action)}`}>
                      {actionLabel(entry.action)}
                    </span>
                    {entry.changedBy && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        von {entry.changedBy}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
