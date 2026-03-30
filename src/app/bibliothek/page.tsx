"use client";

import Image from "next/image";
import Link from "next/link";
import { useDownloads, type ProvisionItem } from "@/contexts/download-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getPosterUrl } from "@/lib/tmdb";
import { Library, Play, Trash2, Film, Star } from "lucide-react";

function LibraryCard({ item }: { item: ProvisionItem }) {
  const { removeProvision } = useDownloads();
  const posterUrl = item.posterPath
    ? getPosterUrl(item.posterPath, "w342")
    : null;
  const year = item.releaseDate?.split("-")[0] ?? "";

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/40 bg-card">
      {/* Poster */}
      <Link
        href={`/movie/${item.movieId}`}
        className="relative block aspect-[2/3] w-full overflow-hidden bg-muted"
      >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Film className="size-10 text-muted-foreground" />
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex size-14 items-center justify-center rounded-full bg-cinema-gold/90">
            <Play className="size-7 fill-black text-black" />
          </div>
        </div>
      </Link>

      {/* Info + actions */}
      <div className="p-3">
        <Link
          href={`/movie/${item.movieId}`}
          className="block truncate text-sm font-medium text-foreground hover:text-cinema-gold"
        >
          {item.title}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5 text-cinema-gold">
              <Star className="size-3 fill-cinema-gold" />
              {item.voteAverage.toFixed(1)}
            </span>
            {year && <span>{year}</span>}
          </div>
          <button
            onClick={() => removeProvision(item.movieId)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`${item.title} löschen`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LibraryContent() {
  const { readyItems } = useDownloads();

  if (readyItems.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Library className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Deine Bibliothek ist leer</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Stelle Filme über die Detailseite bereit — fertige Filme erscheinen
          hier in deiner persönlichen Bibliothek.
        </p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">
        Meine Bibliothek
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {readyItems.length}{" "}
        {readyItems.length === 1 ? "Film" : "Filme"} bereitgestellt
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {readyItems.map((item) => (
          <LibraryCard key={item.movieId} item={item} />
        ))}
      </div>
    </section>
  );
}

export default function BibliothekPage() {
  return (
    <ProtectedRoute message="Melde dich an, um deine Bibliothek zu sehen.">
      <LibraryContent />
    </ProtectedRoute>
  );
}
