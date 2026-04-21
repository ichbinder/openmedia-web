"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VpnProviderOption {
  id: string;
  name: string;
  enabled: boolean;
}

const DEFAULT_BYPASS_LIST =
  "hel1.your-objectstorage.com, api.mediatoken.de, 169.254.169.254";

const CONFIG_KEYS = {
  downloadVpnProviderId: "downloadVpnProviderId",
  uploadVpnProviderId: "uploadVpnProviderId",
  bypassList: "bypassList",
} as const;

export function VpnJobConfig() {
  const [providers, setProviders] = useState<VpnProviderOption[]>([]);
  const [downloadVpnProviderId, setDownloadVpnProviderId] = useState("none");
  const [uploadVpnProviderId, setUploadVpnProviderId] = useState("none");
  const [bypassList, setBypassList] = useState(DEFAULT_BYPASS_LIST);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/admin/config/vpn-providers");
      if (!res.ok) throw new Error("VPN-Provider konnten nicht geladen werden.");
      const data = await res.json();
      const allProviders: VpnProviderOption[] = data.providers || [];
      setProviders(allProviders.filter((p) => p.enabled));
    } catch (err) {
      setError((err as Error).message);
      setLoadError(true);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/backend/admin/config/entries/vpn"
      );
      if (!res.ok) throw new Error("Config-Werte konnten nicht geladen werden.");
      const data = await res.json();
      const entries: { key: string; value: string }[] = data.entries || [];

      for (const entry of entries) {
        if (entry.key === CONFIG_KEYS.downloadVpnProviderId) {
          setDownloadVpnProviderId(entry.value || "none");
        } else if (entry.key === CONFIG_KEYS.uploadVpnProviderId) {
          setUploadVpnProviderId(entry.value || "none");
        } else if (entry.key === CONFIG_KEYS.bypassList) {
          if (entry.value) setBypassList(entry.value);
        }
      }
    } catch (err) {
      setError((err as Error).message);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProviders(), fetchConfig()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProviders, fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const toValue = (v: string) => (v === "none" ? "" : v);
      const puts = [
        {
          categoryName: "vpn",
          key: CONFIG_KEYS.downloadVpnProviderId,
          value: toValue(downloadVpnProviderId),
        },
        {
          categoryName: "vpn",
          key: CONFIG_KEYS.uploadVpnProviderId,
          value: toValue(uploadVpnProviderId),
        },
        {
          categoryName: "vpn",
          key: CONFIG_KEYS.bypassList,
          value: bypassList,
        },
      ];

      await Promise.all(
        puts.map(async (body) => {
          const res = await fetch("/api/backend/admin/config/entries", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Speichern fehlgeschlagen.");
          }
          return res;
        }),
      );

      setSuccess(true);
      successTimerRef.current = setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Lade VPN-Zuweisung…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs underline"
          >
            Schließen
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Download VPN-Provider</Label>
          <Select
            value={downloadVpnProviderId}
            onValueChange={(v) => { if (v) setDownloadVpnProviderId(v); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Kein VPN" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein VPN</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Upload VPN-Provider</Label>
          <Select
            value={uploadVpnProviderId}
            onValueChange={(v) => { if (v) setUploadVpnProviderId(v); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Kein VPN" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein VPN</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Bypass-Liste (DNS/CIDR, kommasepariert)</Label>
        <Textarea
          value={bypassList}
          onChange={(e) => setBypassList(e.target.value)}
          placeholder={DEFAULT_BYPASS_LIST}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Hosts und Netzwerke, die nicht über den VPN-Tunnel geroutet werden.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || loadError}>
          {saving ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-4" />
          )}
          Speichern
        </Button>
        {success && (
          <span className="text-sm text-green-600">Gespeichert!</span>
        )}
      </div>
    </div>
  );
}
