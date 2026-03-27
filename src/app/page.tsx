import { Film } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Film className="mb-6 size-16 text-cinema-gold" />
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        CineScope
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        Entdecke Filme, durchsuche Genres und finde deinen nächsten
        Lieblingsfilm — powered by TMDB.
      </p>
    </div>
  );
}
