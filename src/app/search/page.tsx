import { Suspense } from "react";
import type { Metadata } from "next";
import { searchMovies, searchShows } from "@/lib/tmdb";
import { SearchInput } from "@/components/search/search-input";
import { SearchMovieCard } from "@/components/search/search-movie-card";
import { ShowCard } from "@/components/show/show-card";
import { RecentSearches } from "@/components/search/recent-searches";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q
      ? `Suche: ${q} – CineScope`
      : "Suche – CineScope",
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <div className="px-4 py-8 md:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground">
        Suche
      </h1>

      <div className="mb-8 max-w-xl">
        <Suspense>
          <SearchInput />
        </Suspense>
      </div>

      {query && query.length >= 2 ? (
        <>
          <SearchResults query={query} />
          <ShowResults query={query} />
        </>
      ) : (
        <Suspense>
          <RecentSearches />
        </Suspense>
      )}
    </div>
  );
}

async function SearchResults({ query }: { query: string }) {
  const data = await searchMovies(query);

  if (data.results.length === 0) {
    return (
      <p className="text-muted-foreground">
        Keine Filme gefunden für &ldquo;{query}&rdquo;.
      </p>
    );
  }

  return (
    <section>
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Ergebnisse für &bdquo;{query}&ldquo;
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {data.results.map((movie) => (
          <SearchMovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}

async function ShowResults({ query }: { query: string }) {
  let shows;
  try {
    shows = (await searchShows(query)).results;
  } catch {
    return null;
  }

  if (shows.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Serien
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>
    </section>
  );
}
