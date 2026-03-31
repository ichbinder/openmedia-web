// Auth types and API helpers — real backend via /api/backend/auth/*

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends AuthCredentials {
  name: string;
}

export type AuthResult =
  | { success: true; user: AuthUser }
  | { success: false; error: string };

const API_BASE = "/api/backend/auth";

export async function registerUser(data: RegisterData): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      return { success: false, error: json.error || "Registrierung fehlgeschlagen." };
    }

    return { success: true, user: json.user };
  } catch {
    return { success: false, error: "Verbindung zum Server fehlgeschlagen." };
  }
}

export async function loginUser(credentials: AuthCredentials): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    const json = await res.json();

    if (!res.ok) {
      return { success: false, error: json.error || "Anmeldung fehlgeschlagen." };
    }

    return { success: true, user: json.user };
  } catch {
    return { success: false, error: "Verbindung zum Server fehlgeschlagen." };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE}/logout`, { method: "POST" });
  } catch {
    // Cookie wird serverseitig gelöscht — Fehler hier ist unkritisch
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/me`);

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json.user ?? null;
  } catch {
    return null;
  }
}
