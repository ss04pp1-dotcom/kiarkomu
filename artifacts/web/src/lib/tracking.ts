const CONSENT_KEY = "shohure_cookie_consent";
const API_BASE = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "https://shohure-api.onrender.com";

// ── Session ID ──────────────────────────────────────────────────────────────
let _sessionId: string | null = null;
function getSessionId(): string {
  if (_sessionId) return _sessionId;
  if (typeof window !== "undefined") {
    let id = sessionStorage.getItem("shohure_session_id");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("shohure_session_id", id);
    }
    _sessionId = id;
    return id;
  }
  // SSR path — return sentinel value; logInternal guards against this
  return "ssr";
}

// ── UTM Capture ─────────────────────────────────────────────────────────────
const UTM_STORAGE_KEY = "shohure_utm";

interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

function captureUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  // Already captured for this session — return cached value
  const cached = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch { return {}; }
  }
  const params = new URLSearchParams(window.location.search);
  const utm: UtmParams = {};
  if (params.get("utm_source")) utm.utm_source = params.get("utm_source")!;
  if (params.get("utm_medium")) utm.utm_medium = params.get("utm_medium")!;
  if (params.get("utm_campaign")) utm.utm_campaign = params.get("utm_campaign")!;
  if (params.get("utm_content")) utm.utm_content = params.get("utm_content")!;
  if (params.get("utm_term")) utm.utm_term = params.get("utm_term")!;
  // Persist for the whole session so later events carry the same attribution
  if (Object.keys(utm).length > 0) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }
  return utm;
}

// Call once on module load so UTM params from the landing URL are captured
// even when the user navigates to a different page before an event fires.
if (typeof window !== "undefined") {
  captureUtm();
}

function getUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (!stored) return {};
  try { return JSON.parse(stored); } catch { return {}; }
}

// ── Internal event logging ───────────────────────────────────────────────────
async function logInternal(payload: {
  eventType: string;
  productId?: string | number | null;
  productName?: string | null;
  value?: number | null;
}): Promise<void> {
  // Task 3 — SSR guard: never send tracking requests from the server.
  // Next.js can call these functions during SSR (server components / RSC),
  // which would fire network requests with sessionId="ssr" and no real UTM.
  // The API already rejects "ssr" session IDs, but we save the round-trip here.
  if (typeof window === "undefined") return;

  try {
    const utm = getUtm();
    await fetch(`${API_BASE}/api/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        sessionId: getSessionId(),
        utmSource: utm.utm_source ?? null,
        utmMedium: utm.utm_medium ?? null,
        utmCampaign: utm.utm_campaign ?? null,
        utmContent: utm.utm_content ?? null,
        utmTerm: utm.utm_term ?? null,
      }),
    });
  } catch {}
}

// ── Consent helpers ──────────────────────────────────────────────────────────
export function hasTrackingConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONSENT_KEY) === "true";
}

export function grantTrackingConsent(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_KEY, "true");
  window.dispatchEvent(new Event("shohure:consent-granted"));
}

export function declineTrackingConsent(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_KEY, "false");
}

export function consentAnswered(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(CONSENT_KEY) !== null;
}

// ── Pixel / Tag wrappers ──────────────────────────────────────────────────────
// Scripts always load (unconditionally) so window.fbq / window.gtag are
// always available once afterInteractive fires. No consent gate here.
function fbq(...args: any[]): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.fbq === "function") w.fbq(...args);
}

function gtag(...args: any[]): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.gtag === "function") w.gtag(...args);
}

// ── Event types ──────────────────────────────────────────────────────────────
export interface ProductEventParams {
  id: string | number;
  name: string;
  price: number;
  category?: string | null;
  currency?: string;
}

export interface PurchaseEventParams {
  orderId: string | number;
  value: number;
  currency?: string;
  items?: Array<{ id: string | number; name: string; price: number; quantity: number }>;
}

// ── Tracking functions ────────────────────────────────────────────────────────
export function trackViewContent(params: ProductEventParams): void {
  const currency = params.currency ?? "BDT";
  fbq("track", "ViewContent", {
    content_ids: [String(params.id)],
    content_name: params.name,
    content_category: params.category ?? "",
    content_type: "product",
    value: params.price,
    currency,
  });
  gtag("event", "view_item", {
    currency,
    value: params.price,
    items: [{ item_id: String(params.id), item_name: params.name, item_category: params.category ?? "", price: params.price, quantity: 1 }],
  });
  logInternal({ eventType: "view_content", productId: params.id, productName: params.name, value: params.price });
}

export function trackAddToCart(params: ProductEventParams & { quantity?: number }): void {
  const currency = params.currency ?? "BDT";
  const quantity = params.quantity ?? 1;
  fbq("track", "AddToCart", {
    content_ids: [String(params.id)],
    content_name: params.name,
    content_type: "product",
    value: params.price * quantity,
    currency,
  });
  gtag("event", "add_to_cart", {
    currency,
    value: params.price * quantity,
    items: [{ item_id: String(params.id), item_name: params.name, item_category: params.category ?? "", price: params.price, quantity }],
  });
  logInternal({ eventType: "add_to_cart", productId: params.id, productName: params.name, value: params.price * quantity });
}

export function trackInitiateCheckout(params: { value: number; numItems?: number; currency?: string }): void {
  const currency = params.currency ?? "BDT";
  fbq("track", "InitiateCheckout", { value: params.value, currency, num_items: params.numItems ?? 1 });
  gtag("event", "begin_checkout", { currency, value: params.value });
  logInternal({ eventType: "initiate_checkout", value: params.value });
}

export function trackPurchase(params: PurchaseEventParams): void {
  const currency = params.currency ?? "BDT";
  fbq("track", "Purchase", {
    value: params.value,
    currency,
    content_ids: (params.items ?? []).map(i => String(i.id)),
    content_type: "product",
    order_id: String(params.orderId),
  });
  gtag("event", "purchase", {
    transaction_id: String(params.orderId),
    value: params.value,
    currency,
    items: (params.items ?? []).map(i => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.quantity })),
  });
  logInternal({ eventType: "purchase", value: params.value });
}
