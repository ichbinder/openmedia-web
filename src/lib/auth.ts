// Auth types and API helpers — real backend via /api/backend/auth/*

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
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

/** Normalize API response to ensure isAdmin is always a boolean */
function normalizeUser(user: Record<string, unknown>): AuthUser {
  return { ...user, isAdmin: !!user.isAdmin } as AuthUser;
}

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
    return { success: true, user: normalizeUser(json.user), token: json.token };
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
    return { success: true, user: normalizeUser(json.user), token: json.token };
  } catch {
    return { success: false, error: "Verbindung zum Server fehlgeschlagen." };
  }
}

export async function logoutUser(): Promise<void> {
  clearToken();
}

export interface SessionResult {
  user: AuthUser | null;
  /** True if there was a token/cookie but the server rejected it (expired/invalid). */
  wasRejected: boolean;
}

export async function getCurrentUser(): Promise<SessionResult> {
  const token = getToken();

  try {
    // Call /auth/me — the proxy uses the httpOnly cookie if no Bearer token is sent
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/me`, { headers });

    if (res.status === 401) {
      // Server rejected — session expired or token invalid
      if (token) clearToken();
      return { user: null, wasRejected: true };
    }

    if (!res.ok) {
      return { user: null, wasRejected: false };
    }

    const json = await res.json();
    return { user: json.user ? normalizeUser(json.user) : null, wasRejected: false };
  } catch {
    return { user: null, wasRejected: false };
  }
}

/**
 * Check if a stored token exists but is expired (JWT exp claim in the past).
 * Returns true if there was a token that got cleared — signals "session expired".
 */
export function clearIfExpired(): boolean {
  const token = getToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken();
      return true;
    }
  } catch {
    // Malformed token — clear it
    clearToken();
    return true;
  }
  return false;
}
