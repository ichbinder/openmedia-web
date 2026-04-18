"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  History,
  AlertCircle,
  Pencil,
  Lock,
  Loader2,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigHistory } from "./config-history";

interface ConfigCategory {
  id: string;
  name: string;
  displayName: string;
  description: string;
  _count: { entries: number };
}

interface ConfigEntry {
  id: string;
  categoryName: string;
  key: string;
  value: string;
  encrypted: boolean;
  displayName: string;
  description: string;
  updatedAt: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConfigManager() {
  const [categories, setCategories] = useState<ConfigCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchEntriesIdRef = useRef(0);

  // Reveal state per entry
  const [revealedEntries, setRevealedEntries] = useState<Set<string>>(new Set());
  const [revealingEntry, setRevealingEntry] = useState<string | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ConfigEntry | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formEncrypted, setFormEncrypted] = useState(false);
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ConfigEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // History dialog
  const [historyTarget, setHistoryTarget] = useState<{ category: string; key: string } | null>(null);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/admin/config/categories");
      if (!res.ok) throw new Error("Kategorien konnten nicht geladen werden.");
      const data = await res.json();
      setCategories(data.categories || []);
      if (data.categories?.length > 0 && !selectedCategory) {
        setSelectedCategory(data.categories[0].name);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only fetch on mount, selectedCategory is read inside but shouldn't trigger re-fetch
  }, []);

  // Fetch entries for selected category
  const fetchEntries = useCallback(async (categoryName: string) => {
    const requestId = ++fetchEntriesIdRef.current;
    setEntriesLoading(true);
    setRevealedEntries(new Set());
    try {
      const res = await fetch(`/api/backend/admin/config/entries/${encodeURIComponent(categoryName)}`);
      if (requestId !== fetchEntriesIdRef.current) return;
      if (!res.ok) throw new Error("Einträge konnten nicht geladen werden.");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      if (requestId !== fetchEntriesIdRef.current) return;
      setError((err as Error).message);
    } finally {
      if (requestId === fetchEntriesIdRef.current) {
        setEntriesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (selectedCategory) {
      fetchEntries(selectedCategory);
    }
  }, [selectedCategory, fetchEntries]);

  // Reveal a secret value
  const handleReveal = async (entry: ConfigEntry) => {
    if (revealedEntries.has(entry.id)) {
      setRevealedEntries((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
      // Reset the entry value to masked
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, value: "••••••••" } : e)),
      );
      return;
    }

    setRevealingEntry(entry.id);
    try {
      const res = await fetch(
        `/api/backend/admin/config/entries/${encodeURIComponent(entry.categoryName)}/${encodeURIComponent(entry.key)}?reveal=true`,
      );
      if (!res.ok) throw new Error("Geheimer Wert konnte nicht geladen werden.");
      const data = await res.json();
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, value: data.entry.value } : e)),
      );
      setRevealedEntries((prev) => new Set(prev).add(entry.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevealingEntry(null);
    }
  };

  // Open create dialog
  const openCreateDialog = () => {
    setEditingEntry(null);
    setFormKey("");
    setFormValue("");
    setFormEncrypted(false);
    setFormDisplayName("");
    setFormDescription("");
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = async (entry: ConfigEntry) => {
    setEditingEntry(entry);
    setFormKey(entry.key);
    setFormDisplayName(entry.displayName);
    setFormDescription(entry.description);
    setFormEncrypted(entry.encrypted);

    // For encrypted entries, fetch the real value before opening the dialog
    if (entry.encrypted) {
      try {
        const res = await fetch(
          `/api/backend/admin/config/entries/${encodeURIComponent(entry.categoryName)}/${encodeURIComponent(entry.key)}?reveal=true`,
        );
        if (!res.ok) {
          setError("Geheimer Wert konnte nicht entschlüsselt werden. Bearbeitung abgebrochen.");
          return;
        }
        const data = await res.json();
        setFormValue(data.entry.value);
      } catch {
        setError("Geheimer Wert konnte nicht geladen werden. Bearbeitung abgebrochen.");
        return;
      }
    } else {
      setFormValue(entry.value);
    }

    setDialogOpen(true);
  };

  // Submit create/edit
  const handleSubmit = async () => {
    if (!formKey.trim() || !selectedCategory) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/backend/admin/config/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryName: selectedCategory,
          key: formKey.trim(),
          value: formValue,
          encrypted: formEncrypted,
          displayName: formDisplayName.trim(),
          description: formDescription.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Speichern fehlgeschlagen.");
      }

      setDialogOpen(false);
      await fetchEntries(selectedCategory);
      await fetchCategories(); // Update counts
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete entry
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/backend/admin/config/entries/${encodeURIComponent(deleteTarget.categoryName)}/${encodeURIComponent(deleteTarget.key)}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Löschen fehlgeschlagen.");
      }

      setDeleteTarget(null);
      await fetchEntries(selectedCategory);
      await fetchCategories();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
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

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setSelectedCategory(cat.name)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === cat.name
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {cat.displayName}
            <span className="ml-1.5 text-xs opacity-70">({cat._count.entries})</span>
          </button>
        ))}
      </div>

      {/* Entry list */}
      {entriesLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm text-muted-foreground">
              {entries.length} {entries.length === 1 ? "Eintrag" : "Einträge"}
            </p>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-1.5 size-4" />
              Neuer Eintrag
            </Button>
          </div>

          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Keine Einträge in dieser Kategorie.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{entry.key}</span>
                      {entry.encrypted && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Lock className="size-3" />
                          verschlüsselt
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {entry.value}
                    </p>
                    {entry.displayName && (
                      <p className="text-xs text-muted-foreground">{entry.displayName}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {formatDateTime(entry.updatedAt)}
                    </span>

                    {entry.encrypted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleReveal(entry)}
                        disabled={revealingEntry === entry.id}
                        aria-label={
                          revealingEntry === entry.id
                            ? "Wert wird geladen"
                            : revealedEntries.has(entry.id)
                              ? "Wert verbergen"
                              : "Wert anzeigen"
                        }
                      >
                        {revealingEntry === entry.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : revealedEntries.has(entry.id) ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Änderungsverlauf für ${entry.key}`}
                      onClick={() =>
                        setHistoryTarget({ category: entry.categoryName, key: entry.key })
                      }
                    >
                      <History className="size-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${entry.key} bearbeiten`}
                      onClick={() => openEditDialog(entry)}
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      aria-label={`${entry.key} löschen`}
                      onClick={() => setDeleteTarget(entry)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Eintrag bearbeiten" : "Neuer Eintrag"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? `${selectedCategory} / ${editingEntry.key}`
                : `Neuen Eintrag in ${selectedCategory} erstellen`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="config-key">Schlüssel</Label>
              <Input
                id="config-key"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder="z.B. access_key"
                disabled={!!editingEntry}
                className="font-mono"
              />
            </div>

            <div>
              <Label htmlFor="config-value">Wert</Label>
              <Input
                id="config-value"
                type={formEncrypted ? "password" : "text"}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="Wert eingeben"
                className="font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="config-encrypted"
                checked={formEncrypted}
                onChange={(e) => setFormEncrypted(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="config-encrypted" className="text-sm font-normal">
                Wert verschlüsseln (Secret)
              </Label>
            </div>

            <div>
              <Label htmlFor="config-display-name">Anzeigename (optional)</Label>
              <Input
                id="config-display-name"
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                placeholder="z.B. S3 Access Key"
              />
            </div>

            <div>
              <Label htmlFor="config-description">Beschreibung (optional)</Label>
              <Input
                id="config-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Kurze Beschreibung"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !formKey.trim()}>
              {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              {editingEntry ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eintrag löschen</DialogTitle>
            <DialogDescription>
              Soll <span className="font-mono font-medium">{deleteTarget?.key}</span> aus{" "}
              <span className="font-medium">{deleteTarget?.categoryName}</span> gelöscht werden?
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

      {/* History Dialog */}
      {historyTarget && (
        <ConfigHistory
          categoryName={historyTarget.category}
          entryKey={historyTarget.key}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
