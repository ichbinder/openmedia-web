"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RatingPanel } from "@/components/rating/rating-panel";
import { useAuth } from "@/contexts/auth-context";
import { usePersons } from "@/hooks/use-persons";
import { getToken } from "@/lib/auth";
import { getRating, type RatingTitle, type RatingView } from "@/lib/backend";
import { VERDICTS } from "@/lib/rating";

export function RateButton({ kind, tmdbId, name }: RatingTitle) {
  const { user } = useAuth();
  const persons = usePersons();
  const [rating, setRating] = useState<RatingView | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!user || !token) return;
    let active = true;
    getRating(kind, tmdbId, token)
      .then((res) => {
        if (active) setRating(res.ok ? res.data : null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, kind, tmdbId]);

  if (!user) return null;
  const emoji = VERDICTS.find((v) => v.key === rating?.verdict)?.emoji;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
      >
        {emoji ?? "Bewerten"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-label="Bewertung" className="bg-transparent p-0 ring-0 sm:max-w-md">
          <RatingPanel
            title={{ kind, tmdbId, name }}
            initial={rating}
            persons={persons}
            mode="detail"
            onDone={(saved) => {
              setRating(saved);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
