"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Loader2, Search, Film, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchTmdbForAssign, type TmdbSearchResult } from "@/app/actions/tmdb-search";
import { assignMovieToJob } from "@/lib/backend";
import { getToken } from "@/lib/auth";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";
const SEARCH_DEBOUNCE_MS = 300;

interface AssignMovieDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  /** Optional hint shown above the search input — e.g. the original NZB filename. */
  hint?: {
    filename?: string;
  };
  /** Called after a successful assignment so the parent can refresh the job list. */
  onAssigned: () => void;
}

/**
 * Heuristic: pull a candidate movie title out of an NZB filename like
 * "The.Matrix.1999.1080p.BluRay.x264-GROUP.nzb". Strips known release
 * markers (resolution, source, codec, year, group) and converts dots to
 * spaces. Falls back to the raw stem if nothing recognizable is found.
 *
 * Returns an empty string when no useful candidate can be extracted.
 */
function guessTitleFromFilename(filename: string): string {
  // Strip the .nzb extension
  let name = filename.replace(/\.nzb$/i, "");

  // Cut everything from the first 4-digit year (e.g. ".1999.") onward —
  // that's where the release metadata starts.
  const yearMatch = name.match(/\.(19\d{2}|20\d{2})\./);
  if (yearMatch && yearMatch.index !== undefined) {
    name = name.slice(0, yearMatch.index);
  } else {
    // No year? Strip common release markers as a fallback.
    name = name.replace(
      /\.(1080p|2160p|720p|480p|BluRay|WEBRip|WEB-DL|x264|x265|HEVC|HDR|REPACK|PROPER|MULTi|GERMAN|AC3|DTS).*$/i,
      "",
    );
  }

  return name.replace(/[._]+/g, " ").trim();
}

/**
 * Dialog for manually linking a needs_review download job to a TMDB movie.
 *
 * Flow: user types a query → debounced server action call → list of TMDB
 * candidates with poster + title + year → click a candidate → POST
 * /downloads/jobs/:id/assign-movie → toast + close + refresh.
 *
 * The TMDB search runs server-side via a Next.js Server Action, so the
 * TMDB_API_KEY never leaves the host.
 */
export function AssignMovieDialog({
  open,
  onOpenChange,
  jobId,
  hint,
  onAssigned,
}: AssignMovieDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingTmdbId, setSubmittingTmdbId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Pre-populate the search with a guess derived from the NZB filename
  // when the dialog opens — saves the user from typing in 80% of cases.
  useEffect(() => {
    if (open && hint?.filename && !query) {
      const guess = guessTitleFromFilename(hint.filename);
      if (guess.length >= 2) {
        setQuery(guess);
      }
    }
    // Reset state when the dialog closes so re-opening starts fresh.
    if (!open) {
      setQuery("");
      setResults([]);
      setLoading(false);
      setSubmittingTmdbId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search trigger.
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Any pending/in-flight response must be invalidated too.
      requestIdRef.current++;
      setResults([]);
      setLoading(false);
      return;
    }

    // Bump the request id SYNCHRONOUSLY when scheduling a new search, not
    // when the timer fires. Otherwise two fast consecutive queries could
    // fire their timers close enough together that both see the same
    // requestId after increment and the older result overwrites the fresher
    // one.
    const myRequestId = ++requestIdRef.current;
    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchTmdbForAssign(trimmed);
        if (myRequestId === requestIdRef.current) {
          setResults(found);
          setLoading(false);
        }
      } catch (err) {
        if (myRequestId === requestIdRef.current) {
          console.error("[assign-dialog] search failed", err);
          setResults([]);
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const handleAssign = useCallback(
    async (tmdbId: number, movieTitle: string) => {
      const token = getToken();
      if (!token) {
        toast.error("Du bist nicht eingeloggt.");
        return;
      }

      setSubmittingTmdbId(tmdbId);
      try {
        const res = await assignMovieToJob(jobId, tmdbId, token);
        if (!res.ok) {
          const errMsg =
            (res.data as { error?: string } | undefined)?.error ??
            `Zuordnung fehlgeschlagen (HTTP ${res.status})`;
          toast.error(errMsg);
          setSubmittingTmdbId(null);
          return;
        }

        const linkedTitle = res.data?.movie?.titleEn ?? movieTitle;
        if (res.data?.alreadyAssigned) {
          toast.info(`${linkedTitle} war bereits zugeordnet`, {
            description: "Dein Download startet jetzt.",
          });
        } else {
          toast.success(`Zugeordnet: ${linkedTitle}`, {
            description: "Der Download startet automatisch.",
          });
        }

        onAssigned();
        onOpenChange(false);
      } catch (err) {
        console.error("[assign-dialog] assign failed", err);
        toast.error("Zuordnung fehlgeschlagen", {
          description: "Bitte erneut versuchen.",
        });
        setSubmittingTmdbId(null);
      }
    },
    [jobId, onAssigned, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Film zuordnen</DialogTitle>
          <DialogDescription>
            Suche den Film auf TMDB und wähle den passenden Treffer aus, um den
            Download zu starten.
          </DialogDescription>
        </DialogHeader>

        {/* NZB hint block */}
        {hint?.filename && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs space-y-1">
            <div className="flex items-center gap-2 font-medium text-amber-400">
              <AlertCircle className="size-3.5" />
              <span>NZB ohne TMDB-Treffer</span>
            </div>
            <p className="text-muted-foreground truncate">
              <span className="font-mono text-[10px]">{hint.filename}</span>
            </p>
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filmtitel suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Results area — scrollable */}
        <div className="flex-1 overflow-y-auto -mr-2 pr-2 min-h-[200px]">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 rounded-md border border-border/40 p-2">
                  <Skeleton className="h-[90px] w-[60px] shrink-0 rounded" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Search className="size-8 opacity-40 mb-2" />
              <p className="text-sm">Tippe mindestens 2 Zeichen, um zu suchen</p>
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Film className="size-8 opacity-40 mb-2" />
              <p className="text-sm">
                Keine Filme gefunden für &bdquo;{query.trim()}&ldquo;
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((movie) => {
                const posterUrl = movie.posterPath ? `${TMDB_IMAGE_BASE}${movie.posterPath}` : null;
                const isSubmitting = submittingTmdbId === movie.id;
                const anySubmitting = submittingTmdbId !== null;

                return (
                  <li key={movie.id}>
                    <button
                      type="button"
                      onClick={() => handleAssign(movie.id, movie.title)}
                      disabled={anySubmitting}
                      className="flex w-full gap-3 rounded-md border border-border/40 p-2 text-left transition-colors hover:bg-muted/50 hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="relative h-[90px] w-[60px] shrink-0 overflow-hidden rounded bg-muted">
                        {posterUrl ? (
                          <Image
                            src={posterUrl}
                            alt={movie.title}
                            fill
                            className="object-cover"
                            sizes="60px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Film className="size-5 text-muted-foreground" />
                          </div>
                        )}
                        {isSubmitting && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                            <Loader2 className="size-5 animate-spin text-cinema-gold" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <p className="font-medium text-sm truncate">
                          {movie.title}
                          {movie.year && (
                            <span className="text-muted-foreground font-normal ml-1">
                              ({movie.year})
                            </span>
                          )}
                        </p>
                        {movie.originalTitle && movie.originalTitle !== movie.title && (
                          <p className="text-xs text-muted-foreground truncate">
                            {movie.originalTitle}
                          </p>
                        )}
                        {movie.overview && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {movie.overview}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
