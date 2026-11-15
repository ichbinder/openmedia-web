"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { traktConnect, traktPoll, type TraktCounts } from "@/lib/backend";
import { getToken } from "@/lib/auth";

interface TraktStepProps {
  importedAt: string | null;
  counts: TraktCounts | null;
}

interface Pairing {
  userCode: string;
  verificationUrl: string;
}

const NOT_CONFIGURED = "Trakt ist noch nicht eingerichtet";
const IMPORT_FAILED = "Trakt-Import fehlgeschlagen – bitte neu starten";
const POLL_MESSAGES: Record<string, string> = {
  expired: "Code abgelaufen – bitte neu starten",
  denied: "Abgelehnt bei Trakt",
};

export function countsText({ rated, seen, skipped }: TraktCounts): string {
  return `${rated + seen} Titel übernommen (${rated} bewertet, ${seen} gesehen, ${skipped} übersprungen)`;
}

export function TraktStep({ importedAt, counts }: TraktStepProps) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [result, setResult] = useState({ importedAt, counts });
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function fail(message: string) {
    setPairing(null);
    setError(message);
  }

  async function poll(token: string, intervalSeconds: number) {
    let answer;
    try {
      answer = await traktPoll(token);
    } catch {
      if (alive.current) fail(IMPORT_FAILED);
      return;
    }
    if (!alive.current) return;
    if (!answer.ok) return fail(IMPORT_FAILED);
    const data = answer.data;
    if (data.status === "pending") {
      timer.current = setTimeout(() => void poll(token, intervalSeconds), intervalSeconds * 1000);
    } else if (data.status === "done") {
      setPairing(null);
      setResult({ importedAt: new Date().toISOString(), counts: data.counts });
    } else {
      fail(POLL_MESSAGES[data.status]);
    }
  }

  async function start() {
    const token = getToken();
    if (!token) return;
    setStarting(true);
    setError(null);
    try {
      const res = await traktConnect(token);
      if (!alive.current) return;
      if (!res.ok) {
        fail(res.status === 503 ? NOT_CONFIGURED : IMPORT_FAILED);
        return;
      }
      setPairing({ userCode: res.data.userCode, verificationUrl: res.data.verificationUrl });
      timer.current = setTimeout(() => void poll(token, res.data.interval), res.data.interval * 1000);
    } catch {
      if (alive.current) fail(IMPORT_FAILED);
    } finally {
      if (alive.current) setStarting(false);
    }
  }

  const imported = result.importedAt !== null;

  return (
    <div className="space-y-3">
      {imported && (
        <p className="text-sm">
          {result.counts && <>{countsText(result.counts)}. </>}
          Letzter Import: {new Date(result.importedAt!).toLocaleDateString("de-DE")}
        </p>
      )}
      {pairing && (
        <div className="space-y-2 rounded-md border border-border p-4">
          <p className="text-sm">Öffne den Link und gib dort diesen Code ein:</p>
          <p className="font-mono text-3xl font-bold tracking-widest" data-testid="trakt-code">
            {pairing.userCode}
          </p>
          <a
            href={pairing.verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            {pairing.verificationUrl}
          </a>
          <p className="text-sm text-muted-foreground">Warte auf Trakt …</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" disabled={starting || pairing !== null} onClick={start}>
        {imported ? "Erneut importieren" : "Mit Trakt verbinden"}
      </Button>
    </div>
  );
}
