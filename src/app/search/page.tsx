import { Suspense } from "react";
import type { Metadata } from "next";
import { searchMovies } from "@/lib/tmdb";
import { MovieGrid } from "@/components/movie/movie-grid";
import { SearchInput } from "@/components/search/search-input";

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

      <SearchResults query={query} />
    </div>
  );
}

async function SearchResults({ query }: { query: string }) {
  if (!query || query.length < 2) {
    return (
      <p className="text-muted-foreground">
        Gib einen Suchbegriff ein, um Filme zu finden.
      </p>
    );
  }

  const data = await searchMovies(query);

  if (data.results.length === 0) {
    return (
      <p className="text-muted-foreground">
        Keine Filme gefunden für &ldquo;{query}&rdquo;.
      </p>
    );
  }

  return (
    <MovieGrid
      movies={data.results}
      heading={`Ergebnisse für \u201e${query}\u201c`}
    />
  );
}
