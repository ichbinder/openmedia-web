"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { User, Key } from "lucide-react";
import { ApiTokenManager } from "@/components/profile/api-tokens";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <User className="size-6" />
        Profil
      </h1>

      {/* User info */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Name</dt>
            <dd className="mt-1 font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">E-Mail</dt>
            <dd className="mt-1 font-medium">{user.email}</dd>
          </div>
        </dl>
      </div>

      {/* API Tokens */}
      <div className="mt-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Key className="size-5" />
          API-Tokens
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Erstelle Tokens für die Browser-Extension. Jeder Token identifiziert dich bei Downloads.
        </p>
        <div className="mt-4">
          <ApiTokenManager />
        </div>
      </div>
    </div>
  );
}
