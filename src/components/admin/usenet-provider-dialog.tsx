"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UsenetProvider } from "./usenet-providers";

interface UsenetProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: UsenetProvider | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

export function UsenetProviderDialog({
  open,
  onOpenChange,
  provider,
  onSave,
}: UsenetProviderDialogProps) {
  const isEdit = !!provider;

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [postHost, setPostHost] = useState("");
  const [port, setPort] = useState("563");
  const [ssl, setSsl] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connections, setConnections] = useState("20");
  const [priority, setPriority] = useState("0");
  const [enabled, setEnabled] = useState(true);
  const [isDownload, setIsDownload] = useState(false);
  const [isUpload, setIsUpload] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/provider changes
  useEffect(() => {
    if (open) {
      if (provider) {
        setName(provider.name);
        setHost(provider.host);
        setPostHost(provider.postHost || "");
        setPort(String(provider.port));
        setSsl(provider.ssl);
        setUsername(provider.username);
        setPassword(provider.password === "••••••••" ? "" : provider.password);
        setConnections(String(provider.connections));
        setPriority(String(provider.priority));
        setEnabled(provider.enabled);
        setIsDownload(provider.isDownload);
        setIsUpload(provider.isUpload);
      } else {
        setName("");
        setHost("");
        setPostHost("");
        setPort("563");
        setSsl(true);
        setUsername("");
        setPassword("");
        setConnections("20");
        setPriority("0");
        setEnabled(true);
        setIsDownload(false);
        setIsUpload(false);
      }
      setError(null);
    }
  }, [open, provider]);

  const handleSubmit = async () => {
    // Client-side validation
    if (!name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    if (!host.trim()) {
      setError("Host ist erforderlich.");
      return;
    }
    if (!username.trim()) {
      setError("Benutzername ist erforderlich.");
      return;
    }
    if (!isEdit && !password) {
      setError("Passwort ist erforderlich.");
      return;
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError("Port muss zwischen 1 und 65535 liegen.");
      return;
    }

    const connsNum = parseInt(connections, 10);
    if (isNaN(connsNum) || connsNum < 1 || connsNum > 100) {
      setError("Verbindungen müssen zwischen 1 und 100 liegen.");
      return;
    }

    const prioNum = parseInt(priority, 10);
    if (isNaN(prioNum) || prioNum < 0) {
      setError("Priorität muss >= 0 sein.");
      return;
    }

    const formData: Record<string, unknown> = {
      name: name.trim(),
      host: host.trim(),
      postHost: postHost.trim() || null,
      port: portNum,
      ssl,
      username: username.trim(),
      connections: connsNum,
      priority: prioNum,
      enabled,
      isDownload,
      isUpload,
    };

    // Only include password if provided (for edit: empty = keep current)
    if (password) {
      formData.password = password;
    } else if (!isEdit) {
      formData.password = password;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSave(formData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Provider bearbeiten" : "Neuer Usenet-Provider"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `${provider.name} — Verbindungsdaten bearbeiten`
              : "Neuen Usenet-Provider für Downloads oder Uploads konfigurieren"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <Label htmlFor="provider-name">Name</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Eweka"
            />
          </div>

          {/* Host + Post Host */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="provider-host">Host (Download)</Label>
              <Input
                id="provider-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="news.eweka.nl"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="provider-post-host">Post-Host (Upload)</Label>
              <Input
                id="provider-post-host"
                value={postHost}
                onChange={(e) => setPostHost(e.target.value)}
                placeholder="post.eweka.nl"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Port + Connections + Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="provider-port">Port</Label>
              <Input
                id="provider-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                min={1}
                max={65535}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="provider-connections">Verbindungen</Label>
              <Input
                id="provider-connections"
                type="number"
                value={connections}
                onChange={(e) => setConnections(e.target.value)}
                min={1}
                max={100}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="provider-priority">Priorität</Label>
              <Input
                id="provider-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                min={0}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Username + Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="provider-username">Benutzername</Label>
              <Input
                id="provider-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="dein-username"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="provider-password">
                Passwort{isEdit && " (leer = unverändert)"}
              </Label>
              <Input
                id="provider-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Unverändert lassen" : "Passwort"}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ssl}
                onChange={(e) => setSsl(e.target.checked)}
                className="rounded border-border"
              />
              SSL/TLS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-border"
              />
              Aktiviert
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDownload}
                onChange={(e) => setIsDownload(e.target.checked)}
                className="rounded border-border"
              />
              Für Downloads
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isUpload}
                onChange={(e) => setIsUpload(e.target.checked)}
                className="rounded border-border"
              />
              Für Uploads
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {isEdit ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
