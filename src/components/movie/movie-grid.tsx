import type { Movie } from "@/lib/tmdb";
import { MovieCard } from "@/components/movie/movie-card";

interface MovieGridProps {
  movies: Movie[];
  heading?: string;
}

export function MovieGrid({
  movies,
  heading = "Trending diese Woche",
}: MovieGridProps) {
  if (movies.length === 0) return null;

  return (
    <section className="px-4 py-8 md:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        {heading}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}
