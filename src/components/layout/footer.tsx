export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/60">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p>
{/* tmdb attribution required by API terms */}
          Filmdaten bereitgestellt von{" "}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            TMDB
          </a>
        </p>
        <p className="text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} CineScope. Dieses Produkt verwendet die
          TMDB API, ist aber nicht von TMDB unterstützt oder zertifiziert.
        </p>
      </div>
    </footer>
  );
}
