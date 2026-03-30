import { Film } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <Film className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold text-foreground">
        Seite nicht gefunden
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Die angeforderte Seite existiert nicht oder wurde verschoben.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Zurück zur Startseite
      </Link>
    </div>
  );
}
