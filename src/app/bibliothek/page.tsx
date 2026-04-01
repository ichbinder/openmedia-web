"use client";

import Image from "next/image";
import Link from "next/link";
import { useDownloads } from "@/contexts/download-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getPosterUrl } from "@/lib/tmdb";
import type { DownloadJob } from "@/lib/backend";
import { Library, Download, Film, Loader2 } from "lucide-react";

function LibraryCard({ job }: { job: DownloadJob }) {
  const { getLink } = useDownloads();
  const movie = job.nzbFile?.movie;
  const posterUrl = movie?.posterPath
    ? getPosterUrl(movie.posterPath, "w342")
    : null;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/40 bg-card">
      <Link
        href={`/movie/${movie?.tmdbId || ""}`}
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

      <div className="p-3">
        <h3 className="truncate text-sm font-medium">{movie?.titleDe || movie?.titleEn}</h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {movie?.year && <span>{movie.year}</span>}
          {job.nzbFile?.resolution && (
            <span className="rounded bg-muted px-1.5 py-0.5">{job.nzbFile.resolution}</span>
          )}
          {job.nzbFile?.fileExtension && (
            <span className="uppercase">{job.nzbFile.fileExtension.replace(".", "")}</span>
          )}
        </div>

        <button
          onClick={async () => {
            const url = await getLink(job.nzbFileId);
            if (url) window.open(url, "_blank");
          }}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-cinema-gold px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-cinema-gold/90"
        >
          <Download className="size-4" />
          Herunterladen
        </button>
      </div>
    </div>
  );
}

function LibraryContent() {
  const { completedJobs, isLoading } = useDownloads();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-cinema-gold" />
      </div>
    );
  }

  if (completedJobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center text-muted-foreground">
        <Library className="size-12 opacity-40" />
        <div>
          <p className="text-lg font-medium">Deine Bibliothek ist leer</p>
          <p className="text-sm">Filme die du herunterlädst erscheinen hier.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        {completedJobs.length} {completedJobs.length === 1 ? "Film" : "Filme"} bereitgestellt
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {completedJobs.map((job) => (
          <LibraryCard key={job.id} job={job} />
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
