import { useAppConfig } from "@/contexts/ConfigContext";

interface GoogleConfig {
  googleClientId: string | null;
  googleAndroidClientId: string | null;
  googleIosClientId: string | null;
  isLoading: boolean;
}

export function useGoogleConfig(): GoogleConfig {
  const { config, isLoading } = useAppConfig();

  return {
    googleClientId: config.googleWebClientId || null,
    googleAndroidClientId: config.googleAndroidClientId || null,
    googleIosClientId: config.googleIosClientId || null,
    isLoading,
  };
}
