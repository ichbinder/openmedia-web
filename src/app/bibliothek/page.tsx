"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { getToken } from "@/lib/auth";
import { getPosterUrl } from "@/lib/tmdb";
import {
  type LibraryItem,
  getLibrary,
  removeFromLibrary,
  getDownloadLink,
} from "@/lib/backend";
import {
  Library,
  Download,
  Play,
  Trash2,
  Film,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";

function LibraryCard({
  item,
  onRemove,
}: {
  item: LibraryItem;
  onRemove: (nzbFileId: string) => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const movie = item.nzbFile.movie;
  const posterUrl = movie?.posterPath
    ? getPosterUrl(movie.posterPath, "w342")
    : null;

  const scheduledDeletion = item.nzbFile.scheduledDeletionAt
    ? new Date(item.nzbFile.scheduledDeletionAt)
    : null;
  const daysUntilDeletion = scheduledDeletion
    ? Math.max(0, Math.ceil((scheduledDeletion.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  async function handleDownload() {
    const token = getToken();
    if (!token) return;
    setIsDownloading(true);
    const res = await getDownloadLink(item.nzbFile.id, token);
    if (res.ok && res.data?.url) {
      window.open(res.data.url, "_blank");
    }
    setIsDownloading(false);
  }

  async function handleRemove() {
    const token = getToken();
    if (!token) return;
    setIsRemoving(true);
    const res = await removeFromLibrary(item.nzbFile.id, token);
    if (res.ok) {
      onRemove(item.nzbFile.id);
    }
    setIsRemoving(false);
    setShowConfirm(false);
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/40 bg-card">
      {/* Deletion warning banner */}
      {daysUntilDeletion !== null && (
        <div className="flex items-center gap-1.5 bg-orange-500/20 px-3 py-1.5 text-xs text-orange-400">
          <AlertTriangle className="size-3" />
          <span>Wird in {daysUntilDeletion} {daysUntilDeletion === 1 ? "Tag" : "Tagen"} gelöscht</span>
        </div>
      )}

      {/* Poster */}
      {movie?.tmdbId ? (
        <Link
          href={`/movie/${movie.tmdbId}`}
          className="relative block aspect-[2/3] w-full overflow-hidden bg-muted"
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={movie?.titleDe || ""}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="size-10 text-muted-foreground" />
            </div>
          )}
        </Link>
      ) : (
        <div className="relative block aspect-[2/3] w-full overflow-hidden bg-muted">
          <div className="flex h-full w-full items-center justify-center">
            <Film className="size-10 text-muted-foreground" />
          </div>
        </div>
      )}

      <div className="p-3">
        <h3 className="truncate text-sm font-medium">
          {movie?.titleDe || movie?.titleEn}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {movie?.year && <span>{movie.year}</span>}
          {item.nzbFile.resolution && (
            <span className="rounded bg-muted px-1.5 py-0.5">
              {item.nzbFile.resolution}
            </span>
          )}
          {item.nzbFile.fileExtension && (
            <span className="uppercase">
              {item.nzbFile.fileExtension.replace(".", "")}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-2 flex gap-2">
          {/* Stream button — navigates to movie detail page with auto-play */}
          {movie?.tmdbId && item.nzbFile.s3StreamKey && (
            <Link
              href={`/movie/${movie.tmdbId}#play`}
              className="flex items-center justify-center rounded-md bg-cinema-gold px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-cinema-gold/90"
              title="Film abspielen"
            >
              <Play className="size-3.5 fill-black" />
            </Link>
          )}

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-cinema-gold/20 px-3 py-1.5 text-sm font-medium text-cinema-gold transition-colors hover:bg-cinema-gold/30 disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Laden
          </button>

          {showConfirm ? (
            <div className="flex gap-1">
              <button
                onClick={handleRemove}
                disabled={isRemoving}
                className="rounded-md bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isRemoving ? <Loader2 className="size-3 animate-spin" /> : "Ja"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium hover:bg-muted/80"
              >
                Nein
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-md bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-400"
              title="Aus Bibliothek entfernen"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LibraryContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLibrary = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await getLibrary(token);
    if (res.ok && res.data?.items) {
      setItems(res.data.items);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchLibrary();
  }, [user, fetchLibrary]);

  function handleRemove(nzbFileId: string) {
    setItems((prev) => prev.filter((i) => i.nzbFile.id !== nzbFileId));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-cinema-gold" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center text-muted-foreground">
        <Library className="size-12 opacity-40" />
        <div>
          <p className="text-lg font-medium">Deine Bibliothek ist leer</p>
          <p className="text-sm">
            Filme die du herunterlädst erscheinen hier.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        {items.length} {items.length === 1 ? "Film" : "Filme"} in deiner
        Bibliothek
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <LibraryCard key={item.id} item={item} onRemove={handleRemove} />
        ))}
      </div>
    </>
  );
}

export default function BiblioPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Bibliothek</h1>
        <LibraryContent />
      </div>
    </ProtectedRoute>
  );
}
