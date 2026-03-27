import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMovieDetails } from "@/lib/tmdb";
import { MovieDetailHero } from "@/components/movie/movie-detail-hero";
import { AlertTriangle } from "lucide-react";

interface MoviePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MoviePageProps): Promise<Metadata> {
  const { id } = await params;
  const movieId = Number(id);

  if (isNaN(movieId)) {
    return { title: "Film nicht gefunden — CineScope" };
  }

  try {
    const movie = await getMovieDetails(movieId);
    return {
      title: `${movie.title} — CineScope`,
      description: movie.overview || undefined,
    };
  } catch {
    return { title: "Film nicht gefunden — CineScope" };
  }
}

export default async function MovieDetailPage({ params }: MoviePageProps) {
  const { id } = await params;
  const movieId = Number(id);

  if (isNaN(movieId)) {
    notFound();
  }

  let movie;
  try {
    movie = await getMovieDetails(movieId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <AlertTriangle className="size-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">
          Film konnte nicht geladen werden
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <main>
      <MovieDetailHero movie={movie} />

      {/* T02: Cast section */}
      {/* T02: Trailer section */}
      {/* T02: Similar movies section */}
    </main>
  );
}
