import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";
import Providers from "@/components/Providers";
import WhatsAppButton from "@/components/WhatsAppButton";
import TrackingScripts from "@/components/TrackingScripts";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { fetchCategories } from "@/lib/data";
import { API_BASE_URL } from "@/lib/config";
import type { PublicConfig } from "@/lib/usePublicConfig";

async function fetchPublicConfig(): Promise<PublicConfig> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config/mobile`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchPublicConfig();
  const siteName = config?.siteName || "Shohure";
  return {
    title: `${siteName} - Bangladesh's Trusted Online Shop`,
    description: "Shop electronics, fashion, home & living and more at the best prices.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [cats, initialConfig] = await Promise.all([
    fetchCategories(),
    fetchPublicConfig(),
  ]);

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(sw){sw.unregister();});})}if(window.caches){caches.keys().then(function(k){k.forEach(function(c){caches.delete(c);})})};}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers initialConfig={initialConfig}>
          <TrackingScripts
            facebookPixelId={initialConfig.facebookPixelId}
            googleTagId={initialConfig.googleTagId}
          />
          <ServiceWorkerCleanup />
          <Header categories={cats} />
          <main>{children}</main>
          <Footer />
          <WhatsAppButton />
          <CookieConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
