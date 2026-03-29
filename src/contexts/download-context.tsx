"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth-context";

export type DownloadStatus = "queued" | "downloading" | "completed" | "failed";

export interface DownloadItem {
  movieId: number;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string;
  status: DownloadStatus;
  progress: number; // 0-100
  startedAt: string;
  completedAt: string | null;
}

interface DownloadContextValue {
  items: DownloadItem[];
  startDownload: (movie: Omit<DownloadItem, "status" | "progress" | "startedAt" | "completedAt">) => void;
  cancelDownload: (movieId: number) => void;
  removeDownload: (movieId: number) => void;
  getDownload: (movieId: number) => DownloadItem | undefined;
  activeCount: number;
  completedItems: DownloadItem[];
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

function getStorageKey(userId: string) {
  return `cinescope_downloads_${userId}`;
}

function loadDownloads(userId: string): DownloadItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDownloads(userId: string, items: DownloadItem[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(items));
}

// Simulated download speed: ~10% per second → ~10s total
const TICK_INTERVAL_MS = 500;
const PROGRESS_PER_TICK = 5;

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<DownloadItem[]>([]);
  const userIdRef = useRef<string | null>(null);

  // Load downloads when user changes
  useEffect(() => {
    if (user) {
      userIdRef.current = user.id;
      setItems(loadDownloads(user.id));
    } else {
      userIdRef.current = null;
      setItems([]);
    }
  }, [user]);

  // Single global timer that ticks all active downloads
  const hasActive = items.some(
    (d) => d.status === "downloading" || d.status === "queued"
  );

  useEffect(() => {
    if (!hasActive) return;

    const timer = setInterval(() => {
      setItems((prev) => {
        let changed = false;
        const next = prev.map((d) => {
          if (d.status !== "downloading" && d.status !== "queued") return d;
          changed = true;
          const newProgress = Math.min(d.progress + PROGRESS_PER_TICK, 100);
          if (newProgress >= 100) {
            return {
              ...d,
              status: "completed" as const,
              progress: 100,
              completedAt: new Date().toISOString(),
            };
          }
          return {
            ...d,
            status: "downloading" as const,
            progress: newProgress,
          };
        });
        if (!changed) return prev;
        if (userIdRef.current) {
          saveDownloads(userIdRef.current, next);
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [hasActive]);

  // Persist on change (for non-timer changes like add/remove)
  useEffect(() => {
    if (userIdRef.current && items.length >= 0) {
      saveDownloads(userIdRef.current, items);
    }
  }, [items]);

  const startDownload = useCallback(
    (movie: Omit<DownloadItem, "status" | "progress" | "startedAt" | "completedAt">) => {
      if (!user) return;
      setItems((prev) => {
        if (prev.some((d) => d.movieId === movie.movieId && (d.status === "downloading" || d.status === "queued"))) {
          return prev;
        }
        const filtered = prev.filter((d) => d.movieId !== movie.movieId);
        return [
          ...filtered,
          {
            ...movie,
            status: "queued" as const,
            progress: 0,
            startedAt: new Date().toISOString(),
            completedAt: null,
          },
        ];
      });
    },
    [user]
  );

  const cancelDownload = useCallback(
    (movieId: number) => {
      if (!user) return;
      setItems((prev) =>
        prev.map((d) =>
          d.movieId === movieId && (d.status === "downloading" || d.status === "queued")
            ? { ...d, status: "failed" as const }
            : d
        )
      );
    },
    [user]
  );

  const removeDownload = useCallback(
    (movieId: number) => {
      if (!user) return;
      setItems((prev) => prev.filter((d) => d.movieId !== movieId));
    },
    [user]
  );

  const getDownload = useCallback(
    (movieId: number) => items.find((d) => d.movieId === movieId),
    [items]
  );

  const activeCount = items.filter(
    (d) => d.status === "downloading" || d.status === "queued"
  ).length;

  const completedItems = items.filter((d) => d.status === "completed");

  return (
    <DownloadContext.Provider
      value={{
        items,
        startDownload,
        cancelDownload,
        removeDownload,
        getDownload,
        activeCount,
        completedItems,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloads(): DownloadContextValue {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error("useDownloads must be used within a DownloadProvider");
  }
  return context;
}
