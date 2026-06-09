"use client";
import Script from "next/script";

interface TrackingScriptsProps {
  facebookPixelId?: string | null;
  googleTagId?: string | null;
}

// Loads unconditionally on every page visit for maximum retargeting reach.
// The fbq / gtag wrapper functions in tracking.ts remain in place so
// individual event calls (ViewContent, AddToCart, etc.) still fire correctly,
// but the SDK scripts themselves load immediately via afterInteractive.
export default function TrackingScripts({ facebookPixelId, googleTagId }: TrackingScriptsProps) {
  return (
    <>
      {googleTagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`}
            strategy="afterInteractive"
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleTagId}', { send_page_view: true });
              `,
            }}
          />
        </>
      )}
      {facebookPixelId && (
        <>
          <Script
            id="fb-pixel-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${facebookPixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
          {/* Fallback pixel hit for visitors with JavaScript disabled */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${facebookPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  );
}
