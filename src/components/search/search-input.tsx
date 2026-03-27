"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debouncedQuery = useDebounce(query, 400);

  const pushQuery = useCallback(
    (value: string) => {
      if (value.length >= 2) {
        router.replace(`/search?q=${encodeURIComponent(value)}`);
      } else if (value.length === 0) {
        router.replace("/search");
      }
    },
    [router],
  );

  useEffect(() => {
    pushQuery(debouncedQuery);
  }, [debouncedQuery, pushQuery]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Film suchen..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 pl-9 text-base"
      />
    </div>
  );
}
