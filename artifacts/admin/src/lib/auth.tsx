import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  permissions?: Record<string, boolean> | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const TOKEN_KEY = "shohure_admin_token";

setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    } as any
  });

  useEffect(() => {
    if (error) {
      localStorage.removeItem(TOKEN_KEY);
      setAuthTokenGetter(() => null);
      setToken(null);
      setLocation("/login");
    }
  }, [error, setLocation]);

  const login = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    setToken(newToken);
  };

  const logoutAction = () => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    setToken(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user: user as User | null ?? null, isLoading, login, logout: logoutAction }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
