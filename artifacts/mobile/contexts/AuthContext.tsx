import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "shohure_token";
const USER_KEY = "shohure_user";

// Set token getter immediately at module load so the first API call
// (before the AuthProvider useEffect fires) can still attach the token.
setAuthTokenGetter(async () => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
});

interface User {
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
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  setAuth: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]).then(([savedToken, savedUser]) => {
      if (savedToken) setToken(savedToken);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          // corrupted — ignore
        }
      }
    }).catch(() => {
      // AsyncStorage unavailable — continue as logged out
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const setAuth = async (newUser: User, newToken: string) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, newToken],
      [USER_KEY, JSON.stringify(newUser)],
    ]);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    // Clear auth tokens, user data, and any cached config/settings
    const allKeys = await AsyncStorage.getAllKeys().catch(() => [] as string[]);
    const keysToRemove = allKeys.filter(
      (k) =>
        k === TOKEN_KEY ||
        k === USER_KEY ||
        k.startsWith("shohure_")
    );
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove).catch(() => {});
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
