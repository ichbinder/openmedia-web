"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  Shield,
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
import { VpnProviderDialog } from "./vpn-provider-dialog";

export interface VpnProvider {
  id: string;
  name: string;
  protocol: "wireguard" | "openvpn" | null;
  configBlob: string;
  username: string | null;
  password: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function ProtocolBadge({ protocol }: { protocol: VpnProvider["protocol"] }) {
  if (protocol === "wireguard") {
    return <Badge variant="default" className="text-xs">WireGuard</Badge>;
  }
  if (protocol === "openvpn") {
    return <Badge variant="default" className="text-xs">OpenVPN</Badge>;
  }
  return <Badge variant="destructive" className="text-xs">Unbekannt</Badge>;
}

export function VpnProviders() {
  const [providers, setProviders] = useState<VpnProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<VpnProvider | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<VpnProvider | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reveal state — stores full provider data (configBlob, username, password)
  const [revealedProviders, setRevealedProviders] = useState<Map<string, VpnProvider>>(new Map());
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/admin/config/vpn-providers");
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

  const handleEdit = async (provider: VpnProvider) => {
    setDialogLoading(true);
    setEditingProvider(provider);
    try {
      const res = await fetch(
        `/api/backend/admin/config/vpn-providers/${provider.id}?reveal=true`,
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
      ? `/api/backend/admin/config/vpn-providers/${editingProvider.id}`
      : "/api/backend/admin/config/vpn-providers";
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
    setRevealedProviders(new Map());
    await fetchProviders();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/backend/admin/config/vpn-providers/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Löschen fehlgeschlagen.");
      }
      setDeleteTarget(null);
      setRevealedProviders((prev) => {
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

  const handleReveal = async (provider: VpnProvider) => {
    if (revealedProviders.has(provider.id)) {
      setRevealedProviders((prev) => {
        const next = new Map(prev);
        next.delete(provider.id);
        return next;
      });
      return;
    }

    setRevealingId(provider.id);
    try {
      const res = await fetch(
        `/api/backend/admin/config/vpn-providers/${provider.id}?reveal=true`,
      );
      if (!res.ok) throw new Error("Daten konnten nicht entschlüsselt werden.");
      const data = await res.json();
      setRevealedProviders((prev) => new Map(prev).set(provider.id, data.provider));
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
          <Shield className="mx-auto mb-2 size-8 opacity-50" />
          <p>Keine VPN-Provider konfiguriert.</p>
          <p className="mt-1 text-xs">
            Lege einen VPN-Provider an, um Downloads und Uploads über einen VPN-Tunnel zu ermöglichen.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {providers.map((provider) => {
            const revealed = revealedProviders.get(provider.id);
            const configPreview = revealed
              ? revealed.configBlob.length > 50
                ? revealed.configBlob.slice(0, 50) + "..."
                : revealed.configBlob
              : null;

            return (
              <div key={provider.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{provider.name}</span>
                      <ProtocolBadge protocol={provider.protocol} />
                      {!provider.enabled && (
                        <Badge variant="secondary" className="text-xs">
                          deaktiviert
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <p>
                        Config:{" "}
                        <span className="font-mono">
                          {revealed ? configPreview : "••••••••"}
                        </span>
                      </p>
                      {(revealed ? revealed.username : provider.username) && (
                        <p>
                          User:{" "}
                          <span className="font-mono">
                            {revealed ? revealed.username : provider.username}
                          </span>
                        </p>
                      )}
                      {revealed && revealed.password && (
                        <p>
                          Pass: <span className="font-mono">{revealed.password}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => handleReveal(provider)}
                      disabled={revealingId === provider.id}
                      aria-label={
                        revealedProviders.has(provider.id)
                          ? "Daten verbergen"
                          : "Daten anzeigen"
                      }
                    >
                      {revealingId === provider.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : revealedProviders.has(provider.id) ? (
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
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <VpnProviderDialog
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
