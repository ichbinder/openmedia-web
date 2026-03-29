// Auth types and localStorage helpers — mock implementation, designed to swap for real API later

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

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // simple hash for mock — not secure, placeholder only
}

const USERS_KEY = "cinescope_users";
const SESSION_KEY = "cinescope_session";

// Simple hash for mock purposes — NOT cryptographically secure
function mockHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `mock_${hash.toString(36)}`;
}

function getStoredUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export type AuthResult =
  | { success: true; user: AuthUser }
  | { success: false; error: string };

export function registerUser(data: RegisterData): AuthResult {
  const users = getStoredUsers();
  const existing = users.find(
    (u) => u.email.toLowerCase() === data.email.toLowerCase()
  );
  if (existing) {
    return { success: false, error: "Ein Konto mit dieser E-Mail existiert bereits." };
  }

  const newUser: StoredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: data.email.toLowerCase(),
    name: data.name,
    passwordHash: mockHash(data.password),
  };

  users.push(newUser);
  saveUsers(users);

  const authUser: AuthUser = { id: newUser.id, email: newUser.email, name: newUser.name };
  saveSession(authUser);
  return { success: true, user: authUser };
}

export function loginUser(credentials: AuthCredentials): AuthResult {
  const users = getStoredUsers();
  const user = users.find(
    (u) => u.email.toLowerCase() === credentials.email.toLowerCase()
  );

  if (!user) {
    return { success: false, error: "E-Mail oder Passwort ist falsch." };
  }

  if (user.passwordHash !== mockHash(credentials.password)) {
    return { success: false, error: "E-Mail oder Passwort ist falsch." };
  }

  const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
  saveSession(authUser);
  return { success: true, user: authUser };
}

export function logoutUser() {
  saveSession(null);
}

export function getCurrentUser(): AuthUser | null {
  return getSession();
}
