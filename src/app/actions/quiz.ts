"use server";

import { TMDB_REVALIDATE, tmdbFetch } from "@/lib/tmdb";

export interface QuizTitle {
  kind: "movie" | "show";
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
}

interface DiscoverEntry {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
}

const QUIZ_SIZE = 20;
const MAX_PAGE = 15;

function randomPages(): number[] {
  const first = 1 + Math.floor(Math.random() * MAX_PAGE);
  let second = first;
  while (second === first) second = 1 + Math.floor(Math.random() * MAX_PAGE);
  return [first, second];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchKind(kind: QuizTitle["kind"]): Promise<QuizTitle[]> {
  const endpoint = kind === "movie" ? "discover/movie" : "discover/tv";
  const pages = await Promise.all(
    randomPages().map((page) =>
      tmdbFetch<{ results: DiscoverEntry[] }>(
        endpoint,
        { sort_by: "vote_count.desc", page: String(page) },
        TMDB_REVALIDATE.lists,
      ),
    ),
  );
  return pages.flatMap((p) => p.results).flatMap((entry) => {
    const name = kind === "movie" ? entry.title : entry.name;
    if (!name || entry.id <= 0) return [];
    const year = Number.parseInt((entry.release_date ?? entry.first_air_date ?? "").slice(0, 4), 10);
    return [{ kind, tmdbId: entry.id, name, year: Number.isFinite(year) ? year : null, posterPath: entry.poster_path }];
  });
}

export async function getQuizCandidates(exclude: string[]): Promise<QuizTitle[]> {
  try {
    const skip = new Set(exclude);
    const [movies, shows] = await Promise.all([fetchKind("movie"), fetchKind("show")]);
    const fresh = (titles: QuizTitle[]) =>
      shuffle(titles.filter((t) => !skip.has(`${t.kind}-${t.tmdbId}`)));
    const half = QUIZ_SIZE / 2;
    const pickedMovies = fresh(movies);
    const pickedShows = fresh(shows);
    const picked = [
      ...pickedMovies.slice(0, half),
      ...pickedShows.slice(0, half),
    ];
    const rest = [...pickedMovies.slice(half), ...pickedShows.slice(half)];
    return shuffle([...picked, ...shuffle(rest).slice(0, QUIZ_SIZE - picked.length)]);
  } catch (err) {
    console.error("[quiz] Action failed:", err);
    return [];
  }
}
