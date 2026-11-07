"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getPosterUrl } from "@/lib/tmdb";
import {
  type LibraryItem,
  removeFromLibrary,
  getDownloadLink,
} from "@/lib/backend";
import { Download, Play, Trash2, Film, Loader2, AlertTriangle } from "lucide-react";

export function libraryItemLink(item: LibraryItem): string {
  const { movie, episode } = item.nzbFile;
  return episode ? `/serie/${episode.show.tmdbId}` : `/movie/${movie?.tmdbId}`;
}

export function LibraryCard({
  item,
  onRemove,
}: {
  item: LibraryItem;
  onRemove: (nzbFileId: string) => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { episode } = item.nzbFile;
  const title = episode ? episode.show : item.nzbFile.movie;
  const detailHref = title ? libraryItemLink(item) : null;
  const posterUrl = title?.posterPath
    ? getPosterUrl(title.posterPath, "w342")
    : null;

  const scheduledDeletion = item.nzbFile.scheduledDeletionAt
    ? new Date(item.nzbFile.scheduledDeletionAt)
    : null;
  const daysUntilDeletion = scheduledDeletion
    // eslint-disable-next-line react-hooks/purity
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
      {detailHref ? (
        <Link
          href={detailHref}
          className="relative block aspect-[2/3] w-full overflow-hidden bg-muted"
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title?.titleDe || ""}
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
          {title?.titleDe || title?.titleEn}
        </h3>
        {episode && (
          <p className="truncate text-xs text-muted-foreground">
            S{String(episode.season).padStart(2, "0")}E
            {String(episode.episode).padStart(2, "0")}
            {episode.titleDe ? ` · ${episode.titleDe}` : ""}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {title?.year && <span>{title.year}</span>}
          {(item.nzbFile.qualityTier || item.nzbFile.resolution) && (
            <span className="rounded bg-muted px-1.5 py-0.5">
              {item.nzbFile.qualityTier || item.nzbFile.resolution}
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
          {/* Stream button — navigates to detail page with auto-play */}
          {detailHref && item.nzbFile.s3StreamKey && (
            <Link
              href={`${detailHref}#play`}
              className="flex items-center justify-center rounded-md bg-cinema-gold px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-cinema-gold/90"
              title={episode ? "Folge abspielen" : "Film abspielen"}
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
