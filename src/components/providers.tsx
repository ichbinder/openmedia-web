"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/auth-context";
import { WatchlistProvider } from "@/contexts/watchlist-context";
import { DownloadProvider } from "@/contexts/download-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      disableTransitionOnChange
    >
      <AuthProvider>
        <WatchlistProvider>
          <DownloadProvider>{children}</DownloadProvider>
        </WatchlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
