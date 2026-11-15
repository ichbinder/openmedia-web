import type { TitleMeta } from "@/lib/backend";

export function AllRatings({ meta }: { meta: TitleMeta | null }) {
  if (!meta) return null;
  const { critics, audience, imdb, metacritic, letterboxd, trakt, tmdb } = meta.ratings;
  const entries = [
    critics !== undefined && `🍅 Kritiker ${critics}%`,
    audience !== undefined && `🍿 Zuschauer ${audience}%`,
    imdb !== undefined && `IMDb ${imdb.toFixed(1)}`,
    metacritic !== undefined && `Metacritic ${Math.round(metacritic)}`,
    letterboxd !== undefined && `Letterboxd ${letterboxd.toFixed(1)}`,
    trakt !== undefined && `Trakt ${trakt}%`,
    tmdb !== undefined && `TMDB ${tmdb}%`,
    meta.score !== null && `MDBList ${Math.round(meta.score)}`,
  ].filter((e) => e !== false);
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {entries.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
