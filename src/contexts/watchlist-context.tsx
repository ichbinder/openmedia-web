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
  add: (item: Omit<WatchlistItem, "addedAt">) => void;
  remove: (movieId: number) => void;
  isInWatchlist: (movieId: number) => boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

function getStorageKey(userId: string) {
  return `cinescope_watchlist_${userId}`;
}

function loadWatchlist(userId: string): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(userId: string, items: WatchlistItem[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(items));
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);

  // Load watchlist when user changes
  useEffect(() => {
    if (user) {
      setItems(loadWatchlist(user.id));
    } else {
      setItems([]);
    }
  }, [user]);

  const add = useCallback(
    (item: Omit<WatchlistItem, "addedAt">) => {
      if (!user) return;
      setItems((prev) => {
        if (prev.some((i) => i.movieId === item.movieId)) return prev;
        const next = [...prev, { ...item, addedAt: new Date().toISOString() }];
        saveWatchlist(user.id, next);
        return next;
      });
    },
    [user]
  );

  const remove = useCallback(
    (movieId: number) => {
      if (!user) return;
      setItems((prev) => {
        const next = prev.filter((i) => i.movieId !== movieId);
        saveWatchlist(user.id, next);
        return next;
      });
    },
    [user]
  );

  const isInWatchlist = useCallback(
    (movieId: number) => items.some((i) => i.movieId === movieId),
    [items]
  );

  return (
    <WatchlistContext.Provider value={{ items, add, remove, isInWatchlist }}>
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
