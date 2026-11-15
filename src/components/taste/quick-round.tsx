"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getQuizCandidates, type QuizTitle } from "@/app/actions/quiz";
import { putRating, type Verdict } from "@/lib/backend";
import { getToken } from "@/lib/auth";
import { getPosterUrl } from "@/lib/tmdb";
import { VERDICTS } from "@/lib/rating";

interface QuickRoundProps {
  ratedKeys: string[];
  onRated: (key: string) => void;
}

export function QuickRound({ ratedKeys, onRated }: QuickRoundProps) {
  const [titles, setTitles] = useState<QuizTitle[] | null>(null);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  async function start() {
    setLoading(true);
    setError(null);
    const candidates = await getQuizCandidates(ratedKeys);
    setLoading(false);
    if (candidates.length === 0) {
      setError("Titel konnten nicht geladen werden.");
      return;
    }
    setTitles(candidates);
    setIndex(0);
    setSaved(0);
    setFinished(false);
  }

  function next() {
    if (titles && index + 1 >= titles.length) setFinished(true);
    else setIndex((i) => i + 1);
  }

  async function rate(title: QuizTitle, verdict: Verdict) {
    const token = getToken();
    if (!token) return;
    setError(null);
    try {
      const res = await putRating(title.kind, title.tmdbId, { verdict, source: "quiz" }, token);
      if (!res.ok) throw new Error();
    } catch {
      setError("Das hat leider nicht geklappt.");
      return;
    }
    setSaved((n) => n + 1);
    onRated(`${title.kind}-${title.tmdbId}`);
    next();
  }

  if (!titles || finished) {
    return (
      <div className="space-y-3">
        {finished && <p className="text-sm">Fertig – {saved} Titel bewertet.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="button" disabled={loading} onClick={start}>
          {finished ? "Noch eine Runde" : "Schnell-Runde starten"}
        </Button>
      </div>
    );
  }

  const title = titles[index];
  const poster = getPosterUrl(title.posterPath, "w342");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Titel {index + 1} von {titles.length}
      </p>
      <div className="flex items-center gap-4">
        <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:w-36">
          {poster && <Image src={poster} alt={title.name} fill className="object-cover" sizes="144px" />}
        </div>
        <div>
          <p className="text-lg font-semibold">{title.name}</p>
          <p className="text-sm text-muted-foreground">
            {title.kind === "movie" ? "Film" : "Serie"}
            {title.year ? ` · ${title.year}` : ""}
          </p>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {VERDICTS.map(({ key, emoji, label }) => (
          <Button key={key} type="button" variant="outline" onClick={() => rate(title, key)}>
            <span aria-hidden>{emoji}</span> {label}
          </Button>
        ))}
        <Button type="button" variant="ghost" onClick={next}>
          Nicht gesehen
        </Button>
        <Button type="button" variant="secondary" onClick={() => setFinished(true)}>
          Fertig
        </Button>
      </div>
    </div>
  );
}
