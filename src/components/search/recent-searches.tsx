"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getToken } from "@/lib/auth";
import { getSearchHistory, clearSearchHistory, type SearchHistoryItem } from "@/lib/backend";
import { MovieCard } from "@/components/movie/movie-card";
import type { Movie } from "@/lib/tmdb";

/** Convert SearchHistoryItem to Movie for MovieCard rendering */
function toMovie(item: SearchHistoryItem): Movie {
  return {
    id: item.movieId,
    title: item.title,
    poster_path: item.posterPath,
    vote_average: item.voteAverage,
    release_date: item.releaseDate,
    overview: "",
    backdrop_path: null,
    original_title: item.title,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
    adult: false,
    media_type: "movie",
  };
}

export function RecentSearches() {
  const { user } = useAuth();
  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    getSearchHistory(token, 20)
      .then((res) => {
        if (res.ok && res.data?.items) {
          setItems(res.data.items);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  const handleClear = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const previousItems = items;
    setItems([]);

    try {
      const res = await clearSearchHistory(token);
      if (!res.ok) {
        setItems(previousItems);
      }
    } catch {
      setItems(previousItems);
    }
  }, [items]);

  if (!user) {
    return (
      <p className="text-muted-foreground">
        Melde dich an, um deine Suchhistorie zu sehen.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-cinema-gold" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
        <Clock className="size-10 opacity-40" />
        <p>Noch keine Filme gesucht.</p>
        <p className="text-sm">Filme die du anklickst erscheinen hier.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Clock className="size-5 text-muted-foreground" />
          Zuletzt angesehen
        </h2>
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="size-3.5" />
          Verlauf löschen
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <MovieCard key={item.movieId} movie={toMovie(item)} />
        ))}
      </div>
    </section>
  );
}
