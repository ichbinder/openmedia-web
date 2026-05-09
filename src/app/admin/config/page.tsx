"use client";

import { useState } from "react";
import { Settings, Server, Shield, Activity } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ConfigManager } from "@/components/admin/config-manager";
import { UsenetProviders } from "@/components/admin/usenet-providers";
import { VpnProviders } from "@/components/admin/vpn-providers";
import { VpnJobConfig } from "@/components/admin/vpn-job-config";
import { VpsEvents } from "@/components/admin/vps-events";
import { VpsLimitConfig } from "@/components/admin/vps-limit-config";
import { VpsServerTypesConfig } from "@/components/admin/vps-server-types-config";
import { VpsQueueDashboard } from "@/components/admin/vps-queue-dashboard";
import { ServiceIncidentBanner } from "@/components/admin/service-incident-banner";

type AdminTab = "config" | "usenet" | "vpn" | "events";

export default function AdminConfigPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("config");

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Settings className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Konfiguration</h1>
        </div>

        {user?.isAdmin ? (
          <div className="space-y-4">
            <ServiceIncidentBanner />
            {/* Top-level tabs */}
            <div className="flex gap-2 border-b pb-2">
              <button
                onClick={() => setActiveTab("config")}
                className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "config"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Settings className="size-4" />
                Einstellungen
              </button>
              <button
                onClick={() => setActiveTab("usenet")}
                className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "usenet"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Server className="size-4" />
                Usenet Provider
              </button>
              <button
                onClick={() => setActiveTab("vpn")}
                className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "vpn"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shield className="size-4" />
                VPN Provider
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "events"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Activity className="size-4" />
                VPS Events
              </button>
            </div>

            {activeTab === "config" && (
              <div className="space-y-6">
                <ConfigManager />
                <div>
                  <h3 className="mb-3 text-lg font-semibold">VPS-Limits</h3>
                  <VpsLimitConfig />
                </div>
                <div>
                  <h3 className="mb-3 text-lg font-semibold">VPS Server-Types</h3>
                  <VpsServerTypesConfig />
                </div>
              </div>
            )}
            {activeTab === "usenet" && <UsenetProviders />}
            {activeTab === "vpn" && (
              <div className="space-y-6">
                <VpnProviders />
                <div>
                  <h3 className="mb-3 text-lg font-semibold">VPN-Zuweisung</h3>
                  <VpnJobConfig />
                </div>
              </div>
            )}
            {activeTab === "events" && (
              <div className="space-y-6">
                <VpsQueueDashboard />
                <VpsEvents />
              </div>
            )}
          </div>
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
