import type { RatingTitle, RatingView, Verdict } from "./backend";

export const VERDICTS: { key: Verdict; emoji: string; label: string }[] = [
  { key: "up", emoji: "👍", label: "Super" },
  { key: "meh", emoji: "😐", label: "Ging so" },
  { key: "down", emoji: "👎", label: "Nicht gut" },
];

export const TAGS = [
  { key: "spannend", label: "Spannend" },
  { key: "gut_erzaehlt", label: "Gut erzählt" },
  { key: "witzig", label: "Witzig" },
  { key: "romantisch", label: "Romantisch" },
  { key: "zu_brutal", label: "Zu brutal" },
  { key: "zu_viel_sex", label: "Zu viel Sex" },
  { key: "zaeh", label: "Zäh" },
  { key: "plump", label: "Plump" },
  { key: "vorhersehbar", label: "Vorhersehbar" },
];

export const LIMITS = [
  { key: "gewalt_selbstzweck", label: "Gewalt als Selbstzweck" },
  { key: "sex_hauptinhalt", label: "Sex als Hauptinhalt" },
  { key: "horror", label: "Horror" },
];

export const GENRES = [
  { key: "thriller", label: "Thriller" },
  { key: "mystery", label: "Mystery" },
  { key: "krimi", label: "Krimi" },
  { key: "drama", label: "Drama" },
  { key: "romantik", label: "Liebesfilm/Rom-Com" },
  { key: "komoedie", label: "Komödie" },
  { key: "scifi", label: "Science-Fiction" },
  { key: "fantasy", label: "Fantasy" },
  { key: "action", label: "Action" },
  { key: "horror", label: "Horror" },
  { key: "doku", label: "Dokumentation" },
  { key: "animation", label: "Animation" },
  { key: "historie", label: "Historie" },
  { key: "familie", label: "Familie" },
];

const FINISHED_RATIO = 0.9;

export function shouldAskRating(input: {
  title: RatingTitle | null;
  seasonFinale: boolean;
  rating: RatingView | null;
  positionSec: number;
  durationSec: number;
  ended: boolean;
}): boolean {
  const { title, seasonFinale, rating, positionSec, durationSec, ended } = input;
  if (!title || durationSec <= 0) return false;
  const finished = ended || positionSec / durationSec >= FINISHED_RATIO;
  if (!finished) return false;
  return title.kind === "movie" ? rating?.verdict == null : seasonFinale;
}
