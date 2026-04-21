"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VpnProvider } from "./vpn-providers";

interface VpnProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: VpnProvider | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

function detectProtocol(config: string): "wireguard" | "openvpn" | null {
  const hasInterface = config.includes("[Interface]");
  const hasPeer = config.includes("[Peer]");
  if (hasInterface && hasPeer) return "wireguard";

  const hasClient = /^client\s*$/m.test(config);
  const hasDevTun = /^dev\s+tu[np]/m.test(config);
  const hasDevTap = /^dev\s+tap/m.test(config);
  if (hasClient && (hasDevTun || hasDevTap)) return "openvpn";

  return null;
}

export function VpnProviderDialog({
  open,
  onOpenChange,
  provider,
  onSave,
}: VpnProviderDialogProps) {
  const isEdit = !!provider;

  const [name, setName] = useState("");
  const [configBlob, setConfigBlob] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedProtocol, setDetectedProtocol] = useState<"wireguard" | "openvpn" | null>(null);

  // Reset form when dialog opens/provider changes
  useEffect(() => {
    if (open) {
      if (provider) {
        setName(provider.name);
        setConfigBlob(provider.configBlob || "");
        setUsername(provider.username || "");
        setPassword("");
        setEnabled(provider.enabled);
        setDetectedProtocol(provider.protocol);
      } else {
        setName("");
        setConfigBlob("");
        setUsername("");
        setPassword("");
        setEnabled(true);
        setDetectedProtocol(null);
      }
      setError(null);
    }
  }, [open, provider]);

  // Detect protocol on configBlob change
  useEffect(() => {
    if (configBlob.trim()) {
      setDetectedProtocol(detectProtocol(configBlob));
    } else {
      setDetectedProtocol(null);
    }
  }, [configBlob]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    if (!configBlob.trim()) {
      setError("VPN-Konfiguration ist erforderlich.");
      return;
    }

    const protocol = detectProtocol(configBlob);
    if (!protocol) {
      setError(
        "Config-Format nicht erkannt. WireGuard ([Interface]/[Peer]) oder OpenVPN (client/dev tun) erwartet."
      );
      return;
    }

    const formData: Record<string, unknown> = {
      name: name.trim(),
      configBlob,
      username: username.trim() || null,
      enabled,
    };

    if (password.trim()) {
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
            {isEdit ? "Provider bearbeiten" : "Neuer VPN-Provider"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `${provider.name} — VPN-Konfiguration bearbeiten`
              : "VPN-Konfiguration für Download- oder Upload-VPS"}
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
            <Label htmlFor="vpn-name">Name</Label>
            <Input
              id="vpn-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Mullvad DE"
            />
          </div>

          {/* Config Blob */}
          <div>
            <Label htmlFor="vpn-config">Konfiguration</Label>
            <Textarea
              id="vpn-config"
              value={configBlob}
              onChange={(e) => setConfigBlob(e.target.value)}
              placeholder="WireGuard- oder OpenVPN-Konfiguration einfügen..."
              className="font-mono text-sm"
              rows={8}
            />
            {detectedProtocol && !error && (
              <p className="mt-1 text-xs text-muted-foreground">
                Erkannt: {detectedProtocol === "wireguard" ? "WireGuard" : "OpenVPN"}
              </p>
            )}
          </div>

          {/* Username + Password (optional, for OpenVPN auth-user-pass) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="vpn-username">Benutzername (optional)</Label>
              <Input
                id="vpn-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Für OpenVPN auth-user-pass"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="vpn-password">
                Passwort{isEdit ? " (leer = unverändert)" : " (optional)"}
              </Label>
              <Input
                id="vpn-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Unverändert lassen" : "Für OpenVPN auth-user-pass"}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-border"
              />
              Aktiviert
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
