import crypto from "crypto";
import { logger } from "./logger.js";

const GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const TIMEOUT_MS = 3000;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Derive a stable GA4 client_id from a user identifier.
 * Uses SHA-256 of the identifier, formatted as two numeric segments
 * to match GA4's "<random>.<timestamp>" convention loosely.
 */
export function deriveClientId(identifier: string | number): string {
  const hash = sha256(String(identifier));
  const a = parseInt(hash.slice(0, 10), 16) % 2147483647;
  const b = parseInt(hash.slice(10, 20), 16) % 2147483647;
  return `${a}.${b}`;
}

export interface Ga4EventParams {
  measurementId: string;
  apiSecret: string;
  clientId: string;
  eventName: string;
  params?: Record<string, any>;
  utmSource?: string | null;
}

/**
 * Fire a GA4 Measurement Protocol event.
 * Entirely fire-and-forget — never blocks the caller.
 * Handles network timeouts (${TIMEOUT_MS}ms) and errors silently.
 */
export function fireGa4Event(opts: Ga4EventParams): void {
  const { measurementId, apiSecret, clientId, eventName, params = {}, utmSource } = opts;

  if (!measurementId || !apiSecret) return;

  const eventParams: Record<string, any> = { ...params };

  if (utmSource === "mobile_app") {
    eventParams.engagement_time_msec = 100;
    eventParams.utm_source = "mobile_app";
  }

  const body = JSON.stringify({
    client_id: clientId,
    events: [{ name: eventName, params: eventParams }],
  });

  const url = `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: controller.signal,
  })
    .then(async (res) => {
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logger.warn({ eventName, measurementId, status: res.status, body: text }, "GA4 MP non-2xx response");
      }
    })
    .catch((err) => {
      clearTimeout(timer);
      if (err?.name === "AbortError") {
        logger.warn({ eventName, measurementId }, "GA4 MP request timed out (non-blocking)");
      } else {
        logger.warn({ err, eventName, measurementId }, "GA4 MP network error (non-blocking)");
      }
    });
}

export interface Ga4PurchaseParams {
  measurementId: string;
  apiSecret: string;
  userId: number;
  orderId: number | string;
  value: number;
  currency?: string;
  items?: Array<{ item_id: string; item_name: string; price: number; quantity: number }>;
  couponCode?: string | null;
  utmSource?: string | null;
}

export function fireGa4Purchase(p: Ga4PurchaseParams): void {
  fireGa4Event({
    measurementId: p.measurementId,
    apiSecret: p.apiSecret,
    clientId: deriveClientId(p.userId),
    eventName: "purchase",
    utmSource: p.utmSource,
    params: {
      transaction_id: String(p.orderId),
      value: parseFloat(p.value.toFixed(2)),
      currency: p.currency ?? "BDT",
      coupon: p.couponCode ?? undefined,
      items: p.items ?? [],
    },
  });
}

export interface Ga4ViewItemParams {
  measurementId: string;
  apiSecret: string;
  userId?: number | null;
  productId: number | string;
  productName: string;
  price: number;
  currency?: string;
  categoryName?: string | null;
  utmSource?: string | null;
}

export function fireGa4ViewItem(p: Ga4ViewItemParams): void {
  fireGa4Event({
    measurementId: p.measurementId,
    apiSecret: p.apiSecret,
    clientId: p.userId ? deriveClientId(p.userId) : deriveClientId(`guest-${p.productId}`),
    eventName: "view_item",
    utmSource: p.utmSource,
    params: {
      currency: p.currency ?? "BDT",
      value: parseFloat(p.price.toFixed(2)),
      items: [{
        item_id: String(p.productId),
        item_name: p.productName,
        item_category: p.categoryName ?? undefined,
        price: parseFloat(p.price.toFixed(2)),
        quantity: 1,
      }],
    },
  });
}

export interface Ga4CartItemParams {
  measurementId: string;
  apiSecret: string;
  userId: number;
  productId: number | string;
  productName: string;
  price: number;
  quantity: number;
  currency?: string;
  utmSource?: string | null;
}

export function fireGa4AddToCart(p: Ga4CartItemParams): void {
  fireGa4Event({
    measurementId: p.measurementId,
    apiSecret: p.apiSecret,
    clientId: deriveClientId(p.userId),
    eventName: "add_to_cart",
    utmSource: p.utmSource,
    params: {
      currency: p.currency ?? "BDT",
      value: parseFloat((p.price * p.quantity).toFixed(2)),
      items: [{
        item_id: String(p.productId),
        item_name: p.productName,
        price: parseFloat(p.price.toFixed(2)),
        quantity: p.quantity,
      }],
    },
  });
}

export function fireGa4RemoveFromCart(p: Ga4CartItemParams): void {
  fireGa4Event({
    measurementId: p.measurementId,
    apiSecret: p.apiSecret,
    clientId: deriveClientId(p.userId),
    eventName: "remove_from_cart",
    utmSource: p.utmSource,
    params: {
      currency: p.currency ?? "BDT",
      value: parseFloat((p.price * p.quantity).toFixed(2)),
      items: [{
        item_id: String(p.productId),
        item_name: p.productName,
        price: parseFloat(p.price.toFixed(2)),
        quantity: p.quantity,
      }],
    },
  });
}

export interface Ga4SearchParams {
  measurementId: string;
  apiSecret: string;
  userId?: number | null;
  searchTerm: string;
  resultCount?: number;
  utmSource?: string | null;
  clientIpHint?: string | null;
}

export function fireGa4Search(p: Ga4SearchParams): void {
  const clientId = p.userId
    ? deriveClientId(p.userId)
    : p.clientIpHint
      ? deriveClientId(`guest-ip-${p.clientIpHint}`)
      : deriveClientId("guest-search");
  fireGa4Event({
    measurementId: p.measurementId,
    apiSecret: p.apiSecret,
    clientId,
    eventName: "search",
    utmSource: p.utmSource,
    params: {
      search_term: p.searchTerm,
      ...(p.resultCount !== undefined ? { result_count: p.resultCount } : {}),
    },
  });
}

export interface Ga4BeginCheckoutParams {
  measurementId: string;
  apiSecret: string;
  userId: number;
  value: number;
  currency?: string;
  items?: Array<{ item_id: string; item_name: string; price: number; quantity: number }>;
  couponCode?: string | null;
  utmSource?: string | null;
}

export function fireGa4BeginCheckout(p: Ga4BeginCheckoutParams): void {
  fireGa4Event({
    measurementId: p.measurementId,
    apiSecret: p.apiSecret,
    clientId: deriveClientId(p.userId),
    eventName: "begin_checkout",
    utmSource: p.utmSource,
    params: {
      currency: p.currency ?? "BDT",
      value: parseFloat(p.value.toFixed(2)),
      coupon: p.couponCode ?? undefined,
      items: p.items ?? [],
    },
  });
}
