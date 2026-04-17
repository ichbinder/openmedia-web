"use client";

import { Settings } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ConfigManager } from "@/components/admin/config-manager";

export default function AdminConfigPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Settings className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Konfiguration</h1>
        </div>

        {user?.isAdmin ? (
          <ConfigManager />
        ) : (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">
              Admin-Zugriff erforderlich. Du hast keine Berechtigung diese Seite zu sehen.
            </p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
