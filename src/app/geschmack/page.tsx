"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LikesStep } from "@/components/taste/likes-step";
import { LimitsStep } from "@/components/taste/limits-step";
import { PersonsStep, type PersonDraft } from "@/components/taste/persons-step";
import { QuickRound } from "@/components/taste/quick-round";
import { TraktStep } from "@/components/taste/trakt-step";
import { getRatings, getTaste, putTaste, type Person, type TasteView } from "@/lib/backend";
import { getToken } from "@/lib/auth";
import { clearPersonsCache } from "@/hooks/use-persons";

const SAVE_FAILED = "Das hat leider nicht geklappt.";

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">
        {number}. {title}
      </h2>
      <div className="mt-4 rounded-lg border border-border bg-card p-6">{children}</div>
    </section>
  );
}

function toBody(taste: TasteView, patch: Partial<Pick<TasteView, "persons" | "genres" | "likesText">>) {
  const merged = { ...taste, ...patch };
  return {
    persons: merged.persons.map(({ id, name, limits, limitsText }) => ({ id, name, limits, limitsText })),
    genres: merged.genres,
    likesText: merged.likesText,
  };
}

export default function GeschmackPage() {
  const [taste, setTaste] = useState<TasteView | null>(null);
  const [ratedKeys, setRatedKeys] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void Promise.all([getTaste(token), getRatings(token)])
      .then(([tasteRes, ratingsRes]) => {
        if (!tasteRes.ok) return setLoadFailed(true);
        setTaste(tasteRes.data);
        if (ratingsRes.ok) setRatedKeys(ratingsRes.data.items.map((r) => `${r.kind}-${r.tmdbId}`));
      })
      .catch(() => setLoadFailed(true));
  }, []);

  const save = useCallback(
    async (patch: Partial<Pick<TasteView, "persons" | "genres" | "likesText">>): Promise<string | null> => {
      const token = getToken();
      if (!token || !taste) return SAVE_FAILED;
      try {
        const res = await putTaste(toBody(taste, patch), token);
        if (!res.ok) {
          return (res.data as { error?: string } | null)?.error ?? SAVE_FAILED;
        }
        setTaste(res.data);
        clearPersonsCache();
        return null;
      } catch {
        return SAVE_FAILED;
      }
    },
    [taste],
  );

  function savePersons(drafts: PersonDraft[]) {
    const existing = new Map(taste?.persons.map((p) => [p.id, p]));
    const persons: Person[] = drafts.map((d) => ({
      id: d.id ?? "",
      name: d.name,
      limits: (d.id && existing.get(d.id)?.limits) || [],
      limitsText: (d.id && existing.get(d.id)?.limitsText) || "",
    }));
    return save({ persons });
  }

  return (
    <ProtectedRoute message="Melde dich an, um euren Geschmack einzustellen.">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Heart className="size-6" />
          Geschmack
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Je mehr wir über euren Geschmack wissen, desto besser passen die Vorschläge. Jeder Schritt wird einzeln gespeichert.
        </p>

        {loadFailed && <p role="alert" className="mt-6 text-destructive">Das Profil konnte nicht geladen werden.</p>}
        {!taste && !loadFailed && <p className="mt-6 text-muted-foreground">Lade …</p>}

        {taste && (
          <>
            <Section number={1} title="Personen">
              <PersonsStep persons={taste.persons} onSave={savePersons} />
            </Section>
            <Section number={2} title="Trakt">
              <TraktStep importedAt={taste.traktImportedAt} counts={taste.traktImportCounts} />
            </Section>
            <Section number={3} title="Geschmack">
              {taste.persons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Lege zuerst mindestens eine Person an.</p>
              ) : (
                <LikesStep
                  genres={taste.genres}
                  likesText={taste.likesText}
                  onSave={(genres, likesText) => save({ genres, likesText })}
                />
              )}
            </Section>
            <Section number={4} title="Grenzen">
              {taste.persons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Lege zuerst mindestens eine Person an.</p>
              ) : (
                <LimitsStep
                  key={taste.persons.map((p) => p.id).join()}
                  persons={taste.persons}
                  onSave={(persons) => save({ persons })}
                />
              )}
            </Section>
            <Section number={5} title="Schnell-Runde">
              <QuickRound
                ratedKeys={ratedKeys}
                onRated={(key) => setRatedKeys((cur) => [...cur, key])}
              />
            </Section>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
