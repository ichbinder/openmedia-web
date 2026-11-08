"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  XCircle,
  CloudDownload,
  AlertTriangle,
  ChevronDown,
  Check,
  Clock,
} from "lucide-react";
import { useDownloads, getStatusLabel } from "@/contexts/download-context";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DownloadJob, MovieCandidate } from "@/lib/backend";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DownloadButtonProps {
  movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date: string;
  };
  className?: string;
  hideWhenUnavailable?: boolean;
}

const LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
  fr: "Französisch",
  es: "Spanisch",
  it: "Italienisch",
  ja: "Japanisch",
  ko: "Koreanisch",
  ru: "Russisch",
  pt: "Portugiesisch",
  nl: "Niederländisch",
};

const GROUPS: { label: string; match: (c: MovieCandidate) => boolean }[] = [
  { label: "Deutsch", match: (c) => c.state !== "broken" && c.group === "german" },
  { label: "Kein Deutsch", match: (c) => c.state !== "broken" && c.group === "foreign" },
  { label: "Kino-Mitschnitt", match: (c) => c.state !== "broken" && c.group === "cam" },
  { label: "Fehlerhaft", match: (c) => c.state === "broken" },
];

const REQUEST_ERRORS: Record<string, string> = {
  candidate_gone: "Version nicht mehr verfügbar",
  failed: "Keine passende Version konnte geladen werden",
};

const TERMINAL_JOB_STATUSES = new Set(["completed", "failed", "expired"]);

const isOwnFile = (c: MovieCandidate) => c.key.startsWith("file:");

const languageNames = (c: MovieCandidate) =>
  c.audioLanguages.flatMap((code) => LANGUAGE_NAMES[code] ?? []);

function onlyLanguage(c: MovieCandidate): string | null {
  const names = languageNames(c);
  return names.length === 1 && names[0] !== LANGUAGE_NAMES.de ? names[0] : null;
}

function warningBadge(c: MovieCandidate): string | null {
  if (c.group === "cam") return "Kino-Mitschnitt";
  if (c.group === "german") return null;
  const name = onlyLanguage(c);
  return name ? `Nur ${name}` : "Kein Deutsch";
}

function confirmTexts(c: MovieCandidate) {
  if (c.group === "cam") {
    return {
      title: "Kino-Mitschnitt",
      text: "Diese Version wurde im Kino abgefilmt. Bild und Ton sind schlecht. Trotzdem laden?",
      action: "Trotzdem laden",
    };
  }
  const name = onlyLanguage(c);
  return {
    title: "Kein deutscher Ton",
    text: name
      ? `Diesen Film gibt es bisher nur auf ${name}. Trotzdem laden?`
      : "Diesen Film gibt es bisher nicht auf Deutsch. Trotzdem laden?",
    action: name ? `${name} laden` : "Trotzdem laden",
  };
}

const formatGb = (bytes: number) =>
  `${(bytes / 1e9).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} GB`;

function rowTitle(c: MovieCandidate) {
  const parts = isOwnFile(c)
    ? ["eigene NZB", c.hashPrefix]
    : [c.releaseType ?? "Unbekannt", c.sizeBytes && formatGb(c.sizeBytes)];
  return [c.qualityTier, ...parts].filter(Boolean).join(" · ");
}

function rowDetails(c: MovieCandidate, recommended: boolean) {
  return [
    languageNames(c).join(" + ") || "Sprache unbekannt",
    c.germanSubtitles && "Untertitel DE",
    c.audioDescription && "Hörfilm",
    isOwnFile(c) && "schon im Bestand",
    recommended && "Empfohlen",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function DownloadButton({
  movie,
  className,
  hideWhenUnavailable = false,
}: DownloadButtonProps) {
  const { user } = useAuth();
  const { jobs, cancelJob, getLink, loadMovieCandidates, requestMovie } =
    useDownloads();
  const router = useRouter();

  const [candidates, setCandidates] = useState<MovieCandidate[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [budgetHit, setBudgetHit] = useState(false);
  const [confirming, setConfirming] = useState<{
    candidate: MovieCandidate;
    manual: boolean;
  } | null>(null);

  const loadKey = user ? `${user.id}|${movie.id}` : null;
  const isLoading = loadKey !== null && loadedFor !== loadKey;

  const fetchCandidates = useCallback(
    async () => (await loadMovieCandidates(movie.id)) ?? [],
    [loadMovieCandidates, movie.id],
  );

  useEffect(() => {
    if (!loadKey) return;
    let cancelled = false;
    fetchCandidates().then((list) => {
      if (cancelled) return;
      setCandidates(list);
      setLoadedFor(loadKey);
    });
    return () => {
      cancelled = true;
    };
  }, [loadKey, fetchCandidates]);

  const candidateFileIds = new Set(candidates.flatMap((c) => c.nzbFileId ?? []));
  const finishedJobIds = jobs
    .filter(
      (j) =>
        candidateFileIds.has(j.nzbFileId) &&
        (j.status === "completed" || j.status === "failed"),
    )
    .map((j) => j.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!finishedJobIds) return;
    let cancelled = false;
    fetchCandidates().then((list) => {
      if (!cancelled) setCandidates(list);
    });
    return () => {
      cancelled = true;
    };
  }, [finishedJobIds, fetchCandidates]);

  const activeJobs = new Map(
    jobs
      .filter((j) => !TERMINAL_JOB_STATUSES.has(j.status))
      .map((j) => [j.nzbFileId, j]),
  );
  const jobFor = (c: MovieCandidate) =>
    c.nzbFileId ? activeJobs.get(c.nzbFileId) : undefined;

  async function download(c: MovieCandidate) {
    if (!c.nzbFileId) return;
    const url = await getLink(c.nzbFileId).catch(() => null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function request(c: MovieCandidate, manual: boolean, confirmed = false) {
    if (c.group !== "german" && !confirmed) {
      setConfirming({ candidate: c, manual });
      return;
    }
    setBusy(true);
    try {
      const res = await requestMovie({
        tmdbId: movie.id,
        key: c.key,
        ...(confirmed && { confirmed }),
        ...(manual && { manual }),
      });
      if (res.status === 429) {
        setBudgetHit(true);
        return;
      }
      if (res.reason === "confirm_required") {
        setConfirming({ candidate: c, manual });
        return;
      }
      if (!res.ok) toast.error(REQUEST_ERRORS[res.reason ?? ""] ?? "Anfordern fehlgeschlagen");
      setCandidates(await fetchCandidates());
    } catch {
      toast.error("Anfordern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  function handleRowClick(c: MovieCandidate) {
    const job = jobFor(c);
    if (job) cancelJob(job.id);
    else if (c.state === "ready") download(c);
    else request(c, true);
  }

  if (!user) {
    return (
      <button
        onClick={() => router.push("/login")}
        className={cn(
          "flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80",
          className
        )}
      >
        <Download className="size-4" />
        Anmelden zum Herunterladen
      </button>
    );
  }

  const best = candidates.find((c) => c.state !== "broken");

  if (isLoading || !best) {
    if (!isLoading && hideWhenUnavailable) return null;
    return (
      <button
        disabled
        className={cn(
          "flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground opacity-50",
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <XCircle className="size-4" />
        )}
        {isLoading ? "Suche Versionen…" : "Keine Version gefunden"}
      </button>
    );
  }

  const activeJob = candidates.map(jobFor).find(Boolean);
  const badge = warningBadge(best);
  const tone = activeJob
    ? "bg-cinema-gold/20 text-cinema-gold"
    : best.state === "ready"
      ? "bg-cinema-gold text-black hover:bg-cinema-gold/90"
      : budgetHit
        ? "bg-muted text-muted-foreground"
        : "bg-green-500/20 text-green-400 hover:bg-green-500/30";

  let main;
  if (activeJob) {
    main = (
      <>
        <Loader2 className="size-4 animate-spin" />
        {getStatusLabel(activeJob.status)} · {activeJob.progress}%
      </>
    );
  } else if (best.state === "ready") {
    main = (
      <>
        <Download className="size-4" />
        Herunterladen
        <span className="rounded bg-black/20 px-1.5 py-0.5 text-xs">{best.qualityTier}</span>
      </>
    );
  } else if (budgetHit) {
    main = (
      <>
        <Clock className="size-4" />
        Tageslimit erreicht — morgen wieder
      </>
    );
  } else {
    main = (
      <>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CloudDownload className="size-4" />
        )}
        Verfügbar machen
        <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs">{best.qualityTier}</span>
        {badge && (
          <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-xs text-amber-400">
            {badge}
          </span>
        )}
      </>
    );
  }

  const groups = GROUPS.map((g) => ({ ...g, items: candidates.filter(g.match) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="flex">
      <button
        onClick={() => (best.state === "ready" ? download(best) : request(best, false))}
        disabled={busy || !!activeJob || (budgetHit && best.state !== "ready")}
        className={cn(
          "flex items-center gap-2 rounded-l-md px-4 py-2 text-sm font-medium transition-colors",
          tone,
          className
        )}
      >
        {main}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Alle Versionen"
          className={cn(
            "flex cursor-pointer items-center rounded-r-md border-l border-current/20 px-2 transition-colors",
            tone
          )}
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          {groups.map((g, i) => (
            <div key={g.label}>
              {i > 0 && <DropdownMenuSeparator />}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {g.label}
              </div>
              {g.items.map((c) => (
                <CandidateItem
                  key={c.key}
                  candidate={c}
                  recommended={c === candidates[0]}
                  activeJob={jobFor(c)}
                  disabled={busy}
                  onClick={() => handleRowClick(c)}
                />
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming && (
        <ConfirmDialog
          candidate={confirming.candidate}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null);
            request(confirming.candidate, confirming.manual, true);
          }}
        />
      )}
    </div>
  );
}

function CandidateItem({
  candidate: c,
  recommended,
  activeJob,
  disabled,
  onClick,
}: {
  candidate: MovieCandidate;
  recommended: boolean;
  activeJob: DownloadJob | undefined;
  disabled: boolean;
  onClick: () => void;
}) {
  const isBroken = c.state === "broken";
  const isReady = c.state === "ready";

  return (
    <DropdownMenuItem
      onClick={onClick}
      disabled={isBroken || disabled}
      className={cn("flex items-center justify-between gap-3 px-3 py-2.5", isBroken && "opacity-50")}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isBroken ? (
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
        ) : activeJob ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-cinema-gold" />
        ) : isReady ? (
          <Check className="size-3.5 shrink-0 text-cinema-gold" />
        ) : (
          <CloudDownload className="size-3.5 shrink-0 text-green-400" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className={cn("text-sm font-medium", isBroken && "line-through text-muted-foreground")}>
            {rowTitle(c)}
          </span>
          {isBroken ? (
            c.brokenReason && (
              <span className="max-w-[220px] truncate text-xs text-destructive">
                {c.brokenReason}
              </span>
            )
          ) : (
            <span className="text-xs text-muted-foreground">{rowDetails(c, recommended)}</span>
          )}
          {activeJob && (
            <span className="text-xs text-cinema-gold">
              {getStatusLabel(activeJob.status)} · {activeJob.progress}%
            </span>
          )}
        </div>
      </div>
      {!isBroken && (
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
            activeJob || isReady
              ? "bg-cinema-gold/20 text-cinema-gold"
              : "bg-green-500/10 text-green-400"
          )}
        >
          {activeJob ? "Abbrechen" : isReady ? "Download" : "Starten"}
        </span>
      )}
    </DropdownMenuItem>
  );
}

function ConfirmDialog({
  candidate,
  onCancel,
  onConfirm,
}: {
  candidate: MovieCandidate;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const texts = confirmTexts(candidate);
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{texts.title}</AlertDialogTitle>
          <AlertDialogDescription>{texts.text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{texts.action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { DownloadButton as ProvisionButton };
