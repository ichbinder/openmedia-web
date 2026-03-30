"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth-context";

export interface WatchlistItem {
  movieId: number;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string;
  addedAt: string;
}

interface WatchlistContextValue {
  items: WatchlistItem[];
  isLoading: boolean;
  add: (item: Omit<WatchlistItem, "addedAt">) => Promise<void>;
  remove: (movieId: number) => Promise<void>;
  isInWatchlist: (movieId: number) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

const API_BASE = "/api/backend/watchlist";

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load watchlist from API when user changes
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    fetch(API_BASE)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false));
  }, [user]);

  const add = useCallback(
    async (item: Omit<WatchlistItem, "addedAt">) => {
      if (!user) return;

      // Optimistic update
      const tempItem: WatchlistItem = { ...item, addedAt: new Date().toISOString() };
      setItems((prev) => {
        if (prev.some((i) => i.movieId === item.movieId)) return prev;
        return [tempItem, ...prev];
      });

      try {
        const res = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });

        if (!res.ok) {
          // Rollback on failure
          setItems((prev) => prev.filter((i) => i.movieId !== item.movieId));
        }
      } catch {
        // Rollback on network error
        setItems((prev) => prev.filter((i) => i.movieId !== item.movieId));
      }
    },
    [user]
  );

  const remove = useCallback(
    async (movieId: number) => {
      if (!user) return;

      // Optimistic remove
      const previousItems = items;
      setItems((prev) => prev.filter((i) => i.movieId !== movieId));

      try {
        const res = await fetch(`${API_BASE}/${movieId}`, { method: "DELETE" });

        if (!res.ok) {
          // Rollback on failure
          setItems(previousItems);
        }
      } catch {
        // Rollback on network error
        setItems(previousItems);
      }
    },
    [user, items]
  );

  const isInWatchlist = useCallback(
    (movieId: number) => items.some((i) => i.movieId === movieId),
    [items]
  );

  return (
    <WatchlistContext.Provider value={{ items, isLoading, add, remove, isInWatchlist }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
}
