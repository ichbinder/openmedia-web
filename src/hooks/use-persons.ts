"use client";

import { useEffect, useState } from "react";
import { getTaste, type Person } from "@/lib/backend";
import { getToken } from "@/lib/auth";

let cache: { token: string; persons: Promise<Person[]> } | null = null;

function loadPersons(token: string): Promise<Person[]> {
  if (cache?.token !== token) {
    const persons = getTaste(token)
      .then((res) => (res.ok ? (res.data?.persons ?? []) : Promise.reject()))
      .catch(() => {
        cache = null;
        return [];
      });
    cache = { token, persons };
  }
  return cache.persons;
}

export function usePersons(): Person[] {
  const [persons, setPersons] = useState<Person[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let active = true;
    void loadPersons(token).then((p) => {
      if (active) setPersons(p);
    });
    return () => {
      active = false;
    };
  }, []);

  return persons;
}
