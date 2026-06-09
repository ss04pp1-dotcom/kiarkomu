import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/config";

const DEFAULT_PRIMARY = "#E91E63";
const DEFAULT_SITE_NAME = "Shohure";

interface ThemeContextType {
  primaryColor: string;
  siteName: string;
}

const ThemeContext = createContext<ThemeContextType>({
  primaryColor: DEFAULT_PRIMARY,
  siteName: DEFAULT_SITE_NAME,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/config`)
      .then((r) => r.json())
      .then((data: any) => {
        const color = data?.primaryColor;
        if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
          setPrimaryColor(color);
        }
        if (data?.siteName && typeof data.siteName === "string") {
          setSiteName(data.siteName);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ primaryColor, siteName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
