"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ContinueRow } from "@/components/home/continue-row";
import { SuggestionRow } from "@/components/suggestions/suggestion-row";
import { getToken } from "@/lib/auth";
import { getSuggestions, type SuggestionsView } from "@/lib/backend";
import { formatRunTime } from "@/lib/format-run-time";

const POLL_MS = 10_000;

function VorschlaegeContent() {
  const [view, setView] = useState<SuggestionsView | null>(null);
  const noRows = view !== null && view.status !== "no_key" && view.rows.length === 0;
  const waiting = noRows && view.running;
  const empty = noRows && !view.running;

  useEffect(() => {
    let active = true;
    async function load() {
      const token = getToken();
      if (!token) return;
      const res = await getSuggestions(token).catch(() => null);
      if (active && res?.ok && res.data) setView(res.data);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(async () => {
      const token = getToken();
      const res = token ? await getSuggestions(token).catch(() => null) : null;
      if (res?.ok && res.data) setView(res.data);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waiting]);

  return (
    <>
      <ContinueRow />
      {view?.createdAt && (
        <p className="mx-auto w-full max-w-7xl px-4 pt-6 text-right text-sm text-muted-foreground">
          Stand: {formatRunTime(view.createdAt)}
        </p>
      )}
      {view?.status === "no_key" && (
        <p className="mx-auto w-full max-w-7xl px-4 pt-6 text-sm text-muted-foreground">
          <Link href="/profile" className="text-cinema-gold hover:underline">
            Richte die KI-Vorschläge im Profil ein.
          </Link>
        </p>
      )}
      {waiting && (
        <p className="mx-auto w-full max-w-7xl px-4 pt-6 text-sm text-muted-foreground">
          Die ersten Vorschläge werden erstellt …
        </p>
      )}
      {empty && (
        <p className="mx-auto w-full max-w-7xl px-4 pt-6 text-sm text-muted-foreground">
          Gerade keine Vorschläge.{" "}
          <Link href="/profile" className="text-cinema-gold hover:underline">
            Im Profil kannst du sie neu erstellen.
          </Link>
        </p>
      )}
      {view?.rows.map((row) => (
        <SuggestionRow key={row.key} row={row} />
      ))}
    </>
  );
}

export default function VorschlaegePage() {
  return (
    <ProtectedRoute message="Melde dich an, um deine Vorschläge zu sehen.">
      <VorschlaegeContent />
    </ProtectedRoute>
  );
}
