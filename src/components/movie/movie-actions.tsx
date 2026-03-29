"use client";

import { WatchlistButton } from "@/components/movie/watchlist-button";
import { ProvisionButton } from "@/components/movie/download-button";

interface MovieActionsProps {
  movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date: string;
  };
}

export function MovieActions({ movie }: MovieActionsProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-3 px-4 py-4 md:px-6 lg:px-8">
      <WatchlistButton movie={movie} variant="detail" />
      <ProvisionButton movie={movie} />
    </div>
  );
}
