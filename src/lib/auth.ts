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
  | { success: true; user: AuthUser; token: string }
  | { success: false; error: string };

const API_BASE = "/api/backend/auth";
const TOKEN_KEY = "openmedia_token";

/** Get stored token */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Store token */
function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Clear token */
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

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

    setToken(json.token);
    return { success: true, user: json.user, token: json.token };
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

    setToken(json.token);
    return { success: true, user: json.user, token: json.token };
  } catch {
    return { success: false, error: "Verbindung zum Server fehlgeschlagen." };
  }
}

export async function logoutUser(): Promise<void> {
  clearToken();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      clearToken();
      return null;
    }

    const json = await res.json();
    return json.user ?? null;
  } catch {
    return null;
  }
}
