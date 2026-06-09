import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchAndCacheConfig, type AppConfigSafe, API_BASE_URL } from "@/lib/config";
import { setBaseUrl } from "@workspace/api-client-react";

const DEFAULTS: AppConfigSafe = {
  apiBaseUrl: API_BASE_URL,
  googleWebClientId: "",
  appEmail: "",
  featureFlags: {},
};

interface ConfigContextValue {
  config: AppConfigSafe;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue>({
  config: DEFAULTS,
  isLoading: true,
  refresh: async () => {},
});

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfigSafe>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const c = await fetchAndCacheConfig();
      const finalBaseUrl = c.apiBaseUrl || API_BASE_URL;
      setConfig({ ...c, apiBaseUrl: finalBaseUrl });
      setBaseUrl(finalBaseUrl);
    } catch (err) {
      console.error("Failed to load config:", err);
      setBaseUrl(API_BASE_URL);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <ConfigContext.Provider value={{ config, isLoading, refresh: load }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useAppConfig(): ConfigContextValue {
  return useContext(ConfigContext);
}
