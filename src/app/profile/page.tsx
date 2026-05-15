"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { User, Key, Settings, Server } from "lucide-react";
import { ApiTokenManager } from "@/components/profile/api-tokens";
import { JellyfinPluginSetup } from "@/components/profile/jellyfin-plugin-setup";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute message="Melde dich an, um dein Profil und API-Tokens zu verwalten.">
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
              <dd className="mt-1 font-medium">{user?.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">E-Mail</dt>
              <dd className="mt-1 font-medium">{user?.email}</dd>
            </div>
          </dl>
        </div>

        {/* Admin */}
        {user?.isAdmin && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Settings className="size-5" />
              Administration
            </h2>
            <div className="mt-4 rounded-lg border border-border bg-card p-6">
              <Link
                href="/admin/config"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Settings className="size-4" />
                VPS-Konfiguration verwalten
              </Link>
            </div>
          </div>
        )}

        {/* Jellyfin Plugin Setup */}
        <div className="mt-8">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Server className="size-5" />
            Jellyfin Plugin
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verbinde dein Jellyfin mit openmedia für automatische Bibliotheks-Synchronisation.
          </p>
          <div className="mt-4">
            <JellyfinPluginSetup />
          </div>
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
    </ProtectedRoute>
  );
}
