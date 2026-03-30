import Image from "next/image";
import { User } from "lucide-react";
import type { CastMember } from "@/lib/tmdb";
import { getProfileUrl } from "@/lib/tmdb";

interface CastListProps {
  cast: CastMember[];
}

export function CastList({ cast }: CastListProps) {
  if (cast.length === 0) return null;

  const topCast = [...cast].sort((a, b) => a.order - b.order).slice(0, 12);

  return (
    <section className="px-4 py-8 md:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Besetzung
      </h2>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
        {topCast.map((member) => {
          const profileUrl = getProfileUrl(member.profile_path);
          return (
            <div
              key={member.id}
              className="flex w-28 flex-shrink-0 snap-start flex-col items-center gap-2 text-center"
            >
              {profileUrl ? (
                <div className="relative size-24 overflow-hidden rounded-full">
                  <Image
                    src={profileUrl}
                    alt={member.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
              ) : (
                <div className="flex size-24 items-center justify-center rounded-full bg-muted">
                  <User className="size-10 text-muted-foreground" />
                </div>
              )}
              <div className="w-full">
                <p className="truncate text-sm font-medium text-foreground">
                  {member.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.character}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
