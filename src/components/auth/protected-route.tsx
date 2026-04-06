"use client";

import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  message?: string;
}

export function ProtectedRoute({
  children,
  message = "Du musst eingeloggt sein, um diesen Bereich zu sehen.",
}: ProtectedRouteProps) {
  const { user, isLoading, sessionExpired } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-cinema-gold" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <LogIn className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">
          {sessionExpired ? "Sitzung abgelaufen" : "Anmeldung erforderlich"}
        </h2>
        <p className="max-w-md text-muted-foreground">
          {sessionExpired ? "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." : message}
        </p>
        <div className="flex gap-3">
          <Link href="/login" className={buttonVariants()}>
            Anmelden
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "outline" })}>
            Registrieren
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
