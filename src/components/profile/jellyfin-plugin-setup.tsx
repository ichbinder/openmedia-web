"use client";

import { useState } from "react";
import { Copy, Check, Loader2, Radio, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type SetupState = "idle" | "loading" | "success" | "error";

interface SetupResponse {
  manifestUrl: string;
}

export function JellyfinPluginSetup() {
  const [state, setState] = useState<SetupState>("idle");
  const [manifestUrl, setManifestUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/backend/jellyfin/plugin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Setup fehlgeschlagen.");
        setState("error");
        return;
      }

      const response = data as SetupResponse;
      setManifestUrl(response.manifestUrl);
      setState("success");
    } catch {
      setErrorMsg("Server nicht erreichbar.");
      setState("error");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(manifestUrl);
      setCopied(true);
      toast.success("Manifest-URL kopiert!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("URL konnte nicht kopiert werden.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jellyfin Plugin</CardTitle>
        <CardDescription>
          Verbinde dein Jellyfin mit openmedia, um deine Bibliothek automatisch
          zu synchronisieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "idle" && (
          <Button onClick={handleCreate} className="gap-1.5">
            <Radio className="size-4" />
            Plugin-URL erstellen
          </Button>
        )}

        {state === "loading" && (
          <Button disabled className="gap-1.5">
            <Loader2 className="size-4 animate-spin" />
            Erstelle…
          </Button>
        )}

        {state === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {errorMsg}
            </div>
            <Button onClick={handleCreate} variant="outline" className="gap-1.5">
              Erneut versuchen
            </Button>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-4">
            {/* URL display with copy button */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Manifest-URL</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={manifestUrl}
                  className="font-mono text-xs"
                  data-testid="manifest-url-input"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5"
                  data-testid="copy-url-button"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Kopiert!" : "Kopieren"}
                </Button>
              </div>
            </div>

            {/* 3-step instructions */}
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>
                Öffne dein Jellyfin Dashboard und navigiere zu{" "}
                <code className="rounded bg-muted px-1">Plugins → Catalog</code>
              </li>
              <li>
                Klicke auf{" "}
                <code className="rounded bg-muted px-1">
                  Add Plugin Repository
                </code>{" "}
                und füge die obige URL ein
              </li>
              <li>
                Installiere das openmedia Plugin und starte Jellyfin neu
              </li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
