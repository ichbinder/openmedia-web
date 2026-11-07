import Image from "next/image";
import Link from "next/link";
import { Film, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Show } from "@/lib/tmdb";
import { getPosterUrl } from "@/lib/tmdb";

export function ShowCard({ show }: { show: Show }) {
  const posterUrl = getPosterUrl(show.poster_path, "w342");
  const year = show.first_air_date?.slice(0, 4) ?? "";

  return (
    <div className="group relative">
      <Link href={`/serie/${show.id}`}>
        <Card className="gap-0 overflow-hidden border-0 p-0 ring-0 transition-transform duration-200 group-hover:scale-[1.03] group-hover:ring-1 group-hover:ring-cinema-gold/40">
          <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt={show.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Film className="size-10 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 p-3">
            <h3 className="truncate text-sm font-medium text-foreground">
              {show.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5 text-cinema-gold">
                <Star className="size-3 fill-cinema-gold" />
                {show.vote_average.toFixed(1)}
              </span>
              {year && <span>{year}</span>}
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
