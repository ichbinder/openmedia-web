"use client";

import { useState, useEffect } from "react";
import { WatchlistButton } from "@/components/movie/watchlist-button";
import { ProvisionButton } from "@/components/movie/download-button";
import { PrecacheButton } from "@/components/movie/precache-button";
import { getNzbMovieByTmdb } from "@/lib/backend";
import { getToken } from "@/lib/auth";

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
  const [precacheHash, setPrecacheHash] = useState<string | null>(null);

  // Discover NZB file hash for precache button
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    getNzbMovieByTmdb(movie.id, token).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data?.movie?.nzbFiles?.length) {
        // Pick the first file with a hash — download-button sorts by quality
        const fileWithHash = res.data.movie.nzbFiles.find((f) => f.hash);
        if (fileWithHash) {
          setPrecacheHash(fileWithHash.hash);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [movie.id]);

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-3 px-4 py-4 md:px-6 lg:px-8">
      <WatchlistButton movie={movie} variant="detail" />
      <ProvisionButton movie={movie} />
      {precacheHash && <PrecacheButton movieHash={precacheHash} />}
    </div>
  );
}
