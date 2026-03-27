import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGenres, discoverMoviesByGenre } from "@/lib/tmdb";
import { MovieGrid } from "@/components/movie/movie-grid";
import { AlertTriangle } from "lucide-react";

interface GenrePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: GenrePageProps): Promise<Metadata> {
  const { id } = await params;
  const genres = await getGenres();
  const genre = genres.find((g) => g.id === Number(id));

  if (!genre) {
    return { title: "Genre nicht gefunden — CineScope" };
  }

  return { title: `${genre.name} — CineScope` };
}

export default async function GenreDetailPage({ params }: GenrePageProps) {
  const { id } = await params;
  const genreId = Number(id);

  if (isNaN(genreId)) {
    notFound();
  }

  let genres;
  let movies;
  try {
    [genres, { results: movies }] = await Promise.all([
      getGenres(),
      discoverMoviesByGenre(genreId),
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <AlertTriangle className="size-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">
          Filme konnten nicht geladen werden
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  const genre = genres.find((g) => g.id === genreId);

  if (!genre) {
    notFound();
  }

  if (movies.length === 0) {
    return (
      <section className="px-4 py-8 md:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
          {genre.name}
        </h1>
        <p className="text-muted-foreground">Keine Filme gefunden</p>
      </section>
    );
  }

  return <MovieGrid movies={movies} heading={genre.name} />;
}
