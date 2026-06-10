"use client";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "./config";

export interface PublicConfig {
  siteName?: string | null;
  whatsappNumber?: string | null;
  googleClientId?: string | null;
  googleWebClientId?: string | null;
  googleAndroidClientId?: string | null;
  googleIosClientId?: string | null;
  primaryColor?: string | null;
  announcementText?: string | null;
  promoCardsJson?: string | null;
  enableFreeDelivery?: boolean;
  freeDeliveryThreshold?: number;
  codEnabled?: boolean;
  bkashEnabled?: boolean;
  nagadEnabled?: boolean;
  rocketEnabled?: boolean;
  cardEnabled?: boolean;
  payDeliveryChargeEnabled?: boolean;
  privacyPolicyUrl?: string | null;
  termsOfServiceUrl?: string | null;
  bkashNumber?: string | null;
  nagadNumber?: string | null;
  rocketNumber?: string | null;
  bkashLogoUrl?: string | null;
  nagadLogoUrl?: string | null;
  rocketLogoUrl?: string | null;
  bkashNumberLabel?: string | null;
  nagadNumberLabel?: string | null;
  rocketNumberLabel?: string | null;
  bkashTxnLabel?: string | null;
  nagadTxnLabel?: string | null;
  rocketTxnLabel?: string | null;
  webAnnouncementText?: string | null;
  webAnnouncementActive?: boolean;
  webAnnouncementSpeed?: number;
  facebookPixelId?: string | null;
  googleTagId?: string | null;
  // Contact & support info
  supportAddress?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  // Social media links
  socialFacebook?: string | null;
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialYoutube?: string | null;
}

export function usePublicConfig() {
  return useQuery<PublicConfig>({
    queryKey: ["publicConfig"],
    queryFn: async ({ signal }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/config/mobile`, { signal });
        if (!res.ok) return {};
        return res.json();
      } catch {
        return {};
      }
    },
    staleTime: 60_000,
  });
}
