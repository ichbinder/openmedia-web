"use client";

import { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { getToken } from "@/lib/auth";
import { LibraryCard } from "@/components/library/library-card";
import {
  type LibraryItem,
  getLibrary,
} from "@/lib/backend";
import { Library, Loader2 } from "lucide-react";

function LibraryContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLibrary = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await getLibrary(token);
    if (res.ok && res.data?.items) {
      setItems(res.data.items);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) fetchLibrary();
  }, [user, fetchLibrary]);

  function handleRemove(nzbFileId: string) {
    setItems((prev) => prev.filter((i) => i.nzbFile.id !== nzbFileId));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-cinema-gold" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center text-muted-foreground">
        <Library className="size-12 opacity-40" />
        <div>
          <p className="text-lg font-medium">Deine Bibliothek ist leer</p>
          <p className="text-sm">
            Filme und Serien, die du herunterlädst erscheinen hier.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        {items.length} Titel in deiner
        Bibliothek
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <LibraryCard key={item.id} item={item} onRemove={handleRemove} />
        ))}
      </div>
    </>
  );
}

export default function BiblioPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Bibliothek</h1>
        <LibraryContent />
      </div>
    </ProtectedRoute>
  );
}
