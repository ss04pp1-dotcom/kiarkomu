import { useTheme } from "@/contexts/ThemeContext";

export function useColors() {
  const { primaryColor } = useTheme();
  return {
    background: "#ffffff",
    foreground: "#000000",
    card: "#f5f5f5",
    primary: primaryColor,
    primaryForeground: "#ffffff",
    secondary: "#F3F4F6",
    accent: "#FFF0F5",
    destructive: "#EF4444",
    mutedForeground: "#666666",
    input: "#F3F4F6",
    border: "#dddddd",
  };
}