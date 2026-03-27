"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <AlertTriangle className="size-12 text-destructive" />
      <h1 className="text-2xl font-bold text-foreground">
        Etwas ist schiefgelaufen
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "Ein unerwarteter Fehler ist aufgetreten."}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground/60">
          Fehler-ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Erneut versuchen
      </button>
    </div>
  );
}
