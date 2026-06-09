import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL = "https://shohure-api.onrender.com";

export interface AppConfigSafe {
  apiBaseUrl: string;
  googleWebClientId: string;
  googleAndroidClientId?: string;
  googleIosClientId?: string;
  appEmail: string;
  featureFlags: Record<string, boolean>;
  storageProvider?: string;
  supabaseUrl?: string;
  supabaseBucket?: string;

  // App settings fields
  siteName?: string;
  primaryColor?: string;
  whatsappNumber?: string | null;
  enableFreeDelivery?: boolean;
  freeDeliveryThreshold?: number;
  promoCardsJson?: string | null;

  // Payment methods configuration
  codEnabled?: boolean;
  bkashEnabled?: boolean;
  nagadEnabled?: boolean;
  rocketEnabled?: boolean;
  cardEnabled?: boolean;
  payDeliveryChargeEnabled?: boolean;

  // Payment credentials
  bkashNumber?: string | null;
  nagadNumber?: string | null;
  rocketNumber?: string | null;
  bkashLogoUrl?: string | null;
  nagadLogoUrl?: string | null;
  rocketLogoUrl?: string | null;

  // Legal URLs
  privacyPolicyUrl?: string | null;
  termsOfServiceUrl?: string | null;

  // Display labels
  bkashNumberLabel?: string;
  nagadNumberLabel?: string;
  rocketNumberLabel?: string;
  bkashTxnLabel?: string;
  nagadTxnLabel?: string;
  rocketTxnLabel?: string;
}

const CACHE_KEY = "shohure_app_config";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_TIMESTAMP_KEY = "shohure_app_config_ts";

const DEFAULTS: AppConfigSafe = {
  apiBaseUrl: API_BASE_URL,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  appEmail: "ss04pp1@gmail.com",
  featureFlags: { "test": true },
  storageProvider: "supabase",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://ipxexojjtmwbxuefmfos.supabase.co",
  supabaseBucket: "images",

  // Default values for payments
  codEnabled: true,
  bkashEnabled: true,
  nagadEnabled: true,
  rocketEnabled: true,
  cardEnabled: true,

  // Default labels
  bkashNumberLabel: "PERSONAL NUMBER",
  nagadNumberLabel: "PERSONAL NUMBER",
  rocketNumberLabel: "PERSONAL NUMBER",
  bkashTxnLabel: "Transaction ID (TrxID)",
  nagadTxnLabel: "Transaction ID (TrxID)",
  rocketTxnLabel: "Transaction ID (TrxID)",
};

export async function fetchAndCacheConfig(): Promise<AppConfigSafe> {
  try {
    const tsRaw = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached && tsRaw) {
      const age = Date.now() - parseInt(tsRaw, 10);
      if (age < CACHE_TTL_MS) {
        return { ...DEFAULTS, ...JSON.parse(cached) };
      }
    }
  } catch {}

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API_BASE_URL}/api/config/mobile`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const remote = await res.json();
      const merged: AppConfigSafe = { 
        ...DEFAULTS, 
        ...remote,
        featureFlags: remote.featureFlags || DEFAULTS.featureFlags 
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
      await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
      return merged;
    }
  } catch {}

  try {
    const stale = await AsyncStorage.getItem(CACHE_KEY);
    if (stale) return { ...DEFAULTS, ...JSON.parse(stale) };
  } catch {}

  return DEFAULTS;
}