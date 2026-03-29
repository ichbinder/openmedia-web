import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMovieDetails } from "@/lib/tmdb";
import { MovieDetailHero } from "@/components/movie/movie-detail-hero";
import { MovieActions } from "@/components/movie/movie-actions";
import { CastList } from "@/components/movie/cast-list";
import { TrailerSection } from "@/components/movie/trailer-section";
import { MovieGrid } from "@/components/movie/movie-grid";
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
      <MovieActions
        movie={{
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path,
          vote_average: movie.vote_average,
          release_date: movie.release_date,
        }}
      />
      <CastList cast={movie.credits.cast} />
      <TrailerSection videos={movie.videos.results} />
      <MovieGrid movies={movie.similar.results} heading="Ähnliche Filme" />
    </main>
  );
}
