"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Copy, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApiToken {
  id: string;
  tokenPrefix: string;
  name: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Nie";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tokenStatus(token: ApiToken): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (token.revokedAt) return { label: "Widerrufen", variant: "destructive" };
  if (new Date(token.expiresAt) < new Date()) return { label: "Abgelaufen", variant: "secondary" };
  return { label: "Aktiv", variant: "default" };
}

export function ApiTokenManager() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExpiry, setNewExpiry] = useState("30");
  const [creating, setCreating] = useState(false);

  // Plaintext display state (shown once after creation)
  const [plaintextToken, setPlaintextToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/auth/api-tokens");
      if (!res.ok) throw new Error("Laden fehlgeschlagen");
      const data = await res.json();
      setTokens(data.tokens);
      setError(null);
    } catch {
      setError("Tokens konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/backend/auth/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), expiresInDays: Number(newExpiry) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erstellung fehlgeschlagen");
        return;
      }
      setPlaintextToken(data.token);
      setCreateOpen(false);
      setNewName("");
      setNewExpiry("30");
      fetchTokens();
    } catch {
      setError("Erstellung fehlgeschlagen.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/backend/auth/api-tokens/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Widerruf fehlgeschlagen");
        return;
      }
      fetchTokens();
    } catch {
      setError("Widerruf fehlgeschlagen.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleCopy() {
    if (plaintextToken) {
      navigator.clipboard.writeText(plaintextToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">
            Schließen
          </button>
        </div>
      )}

      {/* Plaintext token display (shown once after creation) */}
      {plaintextToken && (
        <div className="rounded-lg border-2 border-cinema-gold/50 bg-cinema-gold/5 p-4">
          <p className="mb-2 text-sm font-semibold text-cinema-gold">
            Token erstellt — kopiere ihn jetzt! Du siehst ihn nie wieder.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-background px-3 py-2 font-mono text-xs">
              {plaintextToken}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <button
            onClick={() => setPlaintextToken(null)}
            className="mt-2 text-xs text-muted-foreground underline"
          >
            Verstanden, Token gesichert
          </button>
        </div>
      )}

      {/* Create token button + dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger
          render={
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" />
              Neuen Token erstellen
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API-Token erstellen</DialogTitle>
            <DialogDescription>
              Der Token wird einmalig angezeigt. Speichere ihn sicher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="token-name">Name</Label>
              <Input
                id="token-name"
                placeholder="z.B. Chrome Extension, Laptop"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-expiry">Gültigkeitsdauer</Label>
              <Select value={newExpiry} onValueChange={(v) => v && setNewExpiry(v)}>
                <SelectTrigger id="token-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Tage</SelectItem>
                  <SelectItem value="60">60 Tage</SelectItem>
                  <SelectItem value="90">90 Tage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Erstelle…" : "Token erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token list */}
      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine API-Tokens erstellt.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {tokens.map((token) => {
            const status = tokenStatus(token);
            const isActive = !token.revokedAt && new Date(token.expiresAt) >= new Date();

            return (
              <div
                key={token.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{token.name}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      <code className="rounded bg-muted px-1">{token.tokenPrefix}…</code>
                    </span>
                    <span>Erstellt: {formatDate(token.createdAt)}</span>
                    <span>Ablauf: {formatDate(token.expiresAt)}</span>
                    <span>Letzter Zugriff: {formatDateTime(token.lastUsedAt)}</span>
                  </div>
                </div>
                {isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRevoke(token.id)}
                    disabled={deletingId === token.id}
                  >
                    <Trash2 className="mr-1.5 size-4" />
                    {deletingId === token.id ? "…" : "Widerrufen"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
