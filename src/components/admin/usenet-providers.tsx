"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  Server,
  Download,
  Upload,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UsenetProviderDialog } from "./usenet-provider-dialog";

export interface UsenetProvider {
  id: string;
  name: string;
  host: string;
  postHost: string | null;
  port: number;
  ssl: boolean;
  username: string;
  password: string;
  connections: number;
  priority: number;
  enabled: boolean;
  isDownload: boolean;
  isUpload: boolean;
  createdAt: string;
  updatedAt: string;
}

export function UsenetProviders() {
  const [providers, setProviders] = useState<UsenetProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<UsenetProvider | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<UsenetProvider | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Password reveal
  const [revealedPasswords, setRevealedPasswords] = useState<Map<string, string>>(new Map());
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/admin/config/usenet-providers");
      if (!res.ok) throw new Error("Provider konnten nicht geladen werden.");
      const data = await res.json();
      setProviders(data.providers || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleCreate = () => {
    setEditingProvider(null);
    setDialogOpen(true);
  };

  const handleEdit = async (provider: UsenetProvider) => {
    setDialogLoading(true);
    setEditingProvider(provider);
    try {
      const res = await fetch(
        `/api/backend/admin/config/usenet-providers/${provider.id}?reveal=true`,
      );
      if (!res.ok) {
        setError("Provider-Daten konnten nicht geladen werden.");
        setDialogLoading(false);
        return;
      }
      const data = await res.json();
      setEditingProvider(data.provider);
      setDialogOpen(true);
    } catch {
      setError("Provider-Daten konnten nicht geladen werden.");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleSave = async (formData: Record<string, unknown>) => {
    const isEdit = !!editingProvider;
    const url = isEdit
      ? `/api/backend/admin/config/usenet-providers/${editingProvider.id}`
      : "/api/backend/admin/config/usenet-providers";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Speichern fehlgeschlagen.");
    }

    setDialogOpen(false);
    setRevealedPasswords(new Map());
    await fetchProviders();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/backend/admin/config/usenet-providers/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Löschen fehlgeschlagen.");
      }
      setDeleteTarget(null);
      setRevealedPasswords((prev) => {
        const next = new Map(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      await fetchProviders();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleRevealPassword = async (provider: UsenetProvider) => {
    if (revealedPasswords.has(provider.id)) {
      setRevealedPasswords((prev) => {
        const next = new Map(prev);
        next.delete(provider.id);
        return next;
      });
      return;
    }

    setRevealingId(provider.id);
    try {
      const res = await fetch(
        `/api/backend/admin/config/usenet-providers/${provider.id}?reveal=true`,
      );
      if (!res.ok) throw new Error("Passwort konnte nicht entschlüsselt werden.");
      const data = await res.json();
      setRevealedPasswords((prev) => new Map(prev).set(provider.id, data.provider.password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevealingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">
            Schließen
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {providers.length} Provider
        </p>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1.5 size-4" />
          Neuer Provider
        </Button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Server className="mx-auto mb-2 size-8 opacity-50" />
          <p>Keine Usenet-Provider konfiguriert.</p>
          <p className="mt-1 text-xs">
            Lege einen Provider an, um Downloads und Uploads zu ermöglichen.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {providers.map((provider) => (
            <div key={provider.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{provider.name}</span>
                    {!provider.enabled && (
                      <Badge variant="secondary" className="text-xs">
                        deaktiviert
                      </Badge>
                    )}
                    {provider.isDownload && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Download className="size-3" />
                        Download
                      </Badge>
                    )}
                    {provider.isUpload && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Upload className="size-3" />
                        Upload
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Prio {provider.priority}
                    </Badge>
                  </div>

                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <p className="font-mono">
                      {provider.host}:{provider.port}
                      {provider.ssl && " (SSL)"}
                      {" · "}{provider.connections} Verbindungen
                    </p>
                    {provider.postHost && (
                      <p className="font-mono">
                        Post: {provider.postHost}:{provider.port}
                      </p>
                    )}
                    <p>
                      User: <span className="font-mono">{provider.username}</span>
                      {" · "}Pass:{" "}
                      <span className="font-mono">
                        {revealedPasswords.has(provider.id)
                          ? revealedPasswords.get(provider.id)
                          : "••••••••"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleRevealPassword(provider)}
                    disabled={revealingId === provider.id}
                    aria-label={
                      revealedPasswords.has(provider.id)
                        ? "Passwort verbergen"
                        : "Passwort anzeigen"
                    }
                  >
                    {revealingId === provider.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : revealedPasswords.has(provider.id) ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleEdit(provider)}
                    disabled={dialogLoading}
                    aria-label={`${provider.name} bearbeiten`}
                  >
                    {dialogLoading && editingProvider?.id === provider.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Pencil className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(provider)}
                    aria-label={`${provider.name} löschen`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <UsenetProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editingProvider}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provider löschen</DialogTitle>
            <DialogDescription>
              Soll <span className="font-medium">{deleteTarget?.name}</span> gelöscht werden?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
