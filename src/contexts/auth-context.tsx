"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type AuthUser,
  type AuthCredentials,
  type RegisterData,
  type AuthResult,
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (credentials: AuthCredentials) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from cookie on mount — calls /api/backend/auth/me
  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (credentials: AuthCredentials): Promise<AuthResult> => {
    const result = await loginUser(credentials);
    if (result.success) {
      setUser(result.user);
    }
    return result;
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<AuthResult> => {
    const result = await registerUser(data);
    if (result.success) {
      setUser(result.user);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
