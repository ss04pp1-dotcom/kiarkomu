"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { customFetch, setAuthTokenGetter } from "@workspace/api-client-react";
import { API_BASE_URL } from "@/lib/config";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  referralCode: string;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserToken: (user: AuthUser, token: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "shohure_web_token";
const USER_KEY = "shohure_web_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyToken = useCallback((t: string | null) => {
    setAuthTokenGetter(t ? () => t : null);
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await customFetch<{ id: number; name: string; email: string; phone: string | null; avatarUrl: string | null; role: string; referralCode: string; createdAt: string }>(
        `${API_BASE_URL}/api/auth/me`,
        { headers: { Authorization: `Bearer ${stored}` } },
      );
      setUser(data as AuthUser);
      setToken(stored);
      applyToken(stored);
      localStorage.setItem(USER_KEY, JSON.stringify(data));
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setToken(null);
      applyToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyToken]);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      try {
        setUser(JSON.parse(storedUser) as AuthUser);
        setToken(storedToken);
        applyToken(storedToken);
        setIsLoading(false);
        refreshUser();
      } catch {
        refreshUser();
      }
    } else {
      setIsLoading(false);
    }
  }, [applyToken, refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await customFetch<{ user: AuthUser; token: string }>(
        `${API_BASE_URL}/api/auth/login`,
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
          headers: { "Content-Type": "application/json" },
        },
      );
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      setToken(data.token);
      applyToken(data.token);
    },
    [applyToken],
  );

  const logout = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      try {
        await customFetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${stored}` },
        });
      } catch {}
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    applyToken(null);
  }, [applyToken]);

  const setUserToken = useCallback(
    (u: AuthUser, t: string) => {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
      setToken(t);
      applyToken(t);
    },
    [applyToken],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
        setUserToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
