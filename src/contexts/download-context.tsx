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

/**
 * Source: how the film is being provisioned
 * - "usenet": Film exists in Usenet, straightforward download + unpack
 * - "search": Film not in Usenet, requires external search + download + upload to Usenet as backup
 */
export type ProvisionSource = "usenet" | "search";

/**
 * Provisioning status — the stages a film goes through before it's ready:
 *
 * For Usenet source:
 *   queued → downloading → unpacking → ready
 *
 * For Search source:
 *   queued → searching → downloading → unpacking → uploading_backup → ready
 *
 * Either path can end in "failed"
 */
export type ProvisionStatus =
  | "queued"
  | "searching"       // search source only: looking for the film
  | "downloading"     // downloading from Usenet or external source
  | "unpacking"       // extracting/preparing the film
  | "uploading_backup" // search source only: uploading to Usenet as backup
  | "ready"           // film on server, available for stream/download
  | "failed";

export interface ProvisionItem {
  movieId: number;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string;
  source: ProvisionSource;
  status: ProvisionStatus;
  progress: number; // 0-100 overall progress
  startedAt: string;
  completedAt: string | null;
}

interface DownloadContextValue {
  items: ProvisionItem[];
  provisionMovie: (movie: Omit<ProvisionItem, "status" | "progress" | "startedAt" | "completedAt">) => void;
  cancelProvision: (movieId: number) => void;
  removeProvision: (movieId: number) => void;
  getProvision: (movieId: number) => ProvisionItem | undefined;
  activeCount: number;
  readyItems: ProvisionItem[];
  isUsenetAvailable: (movieId: number) => boolean;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

function getStorageKey(userId: string) {
  return `cinescope_provisions_${userId}`;
}

function loadProvisions(userId: string): ProvisionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProvisions(userId: string, items: ProvisionItem[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(items));
}

/**
 * Mock Usenet availability: deterministic based on movieId.
 * ~30% of movies are "in Usenet". Uses a simple hash so the same
 * movie always returns the same result within a session.
 */
function mockUsenetAvailable(movieId: number): boolean {
  // Simple deterministic hash — same movieId always gives same result
  const hash = ((movieId * 2654435761) >>> 0) % 100;
  return hash < 30; // 30% chance
}

// Simulation timing
const TICK_INTERVAL_MS = 500;

// Progress stages for each source type
// Usenet: download (60%) → unpack (40%) = 100%
// Search: search (20%) → download (40%) → unpack (20%) → upload backup (20%) = 100%
function getNextState(item: ProvisionItem): { status: ProvisionStatus; progress: number } {
  const p = item.progress;

  if (item.source === "usenet") {
    // Usenet path: ~10s total (5% per tick)
    const next = Math.min(p + 5, 100);
    if (next < 60) return { status: "downloading", progress: next };
    if (next < 100) return { status: "unpacking", progress: next };
    return { status: "ready", progress: 100 };
  }

  // Search path: ~20s total (2.5% per tick)
  const next = Math.min(p + 2.5, 100);
  if (next < 20) return { status: "searching", progress: next };
  if (next < 60) return { status: "downloading", progress: next };
  if (next < 80) return { status: "unpacking", progress: next };
  if (next < 100) return { status: "uploading_backup", progress: next };
  return { status: "ready", progress: 100 };
}

function getStatusLabel(status: ProvisionStatus, source: ProvisionSource): string {
  switch (status) {
    case "queued": return "Wartend…";
    case "searching": return "Film wird gesucht…";
    case "downloading": return source === "usenet" ? "Lade aus Usenet…" : "Wird heruntergeladen…";
    case "unpacking": return "Wird entpackt…";
    case "uploading_backup": return "Backup ins Usenet…";
    case "ready": return "Bereit";
    case "failed": return "Fehlgeschlagen";
  }
}

export { getStatusLabel };

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ProvisionItem[]>([]);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      userIdRef.current = user.id;
      setItems(loadProvisions(user.id));
    } else {
      userIdRef.current = null;
      setItems([]);
    }
  }, [user]);

  const hasActive = items.some(
    (d) => d.status !== "ready" && d.status !== "failed"
  );

  useEffect(() => {
    if (!hasActive) return;

    const timer = setInterval(() => {
      setItems((prev) => {
        let changed = false;
        const next = prev.map((d) => {
          if (d.status === "ready" || d.status === "failed") return d;
          changed = true;
          const { status, progress } = getNextState(d);
          return {
            ...d,
            status,
            progress,
            completedAt: status === "ready" ? new Date().toISOString() : null,
          };
        });
        if (!changed) return prev;
        if (userIdRef.current) {
          saveProvisions(userIdRef.current, next);
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [hasActive]);

  useEffect(() => {
    if (userIdRef.current && items.length >= 0) {
      saveProvisions(userIdRef.current, items);
    }
  }, [items]);

  const provisionMovie = useCallback(
    (movie: Omit<ProvisionItem, "status" | "progress" | "startedAt" | "completedAt">) => {
      if (!user) return;
      setItems((prev) => {
        if (prev.some((d) => d.movieId === movie.movieId && d.status !== "ready" && d.status !== "failed")) {
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

  const cancelProvision = useCallback(
    (movieId: number) => {
      if (!user) return;
      setItems((prev) =>
        prev.map((d) =>
          d.movieId === movieId && d.status !== "ready" && d.status !== "failed"
            ? { ...d, status: "failed" as const }
            : d
        )
      );
    },
    [user]
  );

  const removeProvision = useCallback(
    (movieId: number) => {
      if (!user) return;
      setItems((prev) => prev.filter((d) => d.movieId !== movieId));
    },
    [user]
  );

  const getProvision = useCallback(
    (movieId: number) => items.find((d) => d.movieId === movieId),
    [items]
  );

  const isUsenetAvailable = useCallback(
    (movieId: number) => mockUsenetAvailable(movieId),
    []
  );

  const activeCount = items.filter(
    (d) => d.status !== "ready" && d.status !== "failed"
  ).length;

  const readyItems = items.filter((d) => d.status === "ready");

  return (
    <DownloadContext.Provider
      value={{
        items,
        provisionMovie,
        cancelProvision,
        removeProvision,
        getProvision,
        activeCount,
        readyItems,
        isUsenetAvailable,
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
