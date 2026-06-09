import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/lib/config";

// ── Persistent Session ID ─────────────────────────────────────────────────────
// Stored in AsyncStorage so it survives app restarts and remains stable for the
// lifetime of the install. A new ID is generated only on first launch.
const SESSION_ID_KEY = "@shohure/tracking_session_id";
let _cachedSessionId: string | null = null;

async function getSessionId(): Promise<string> {
  if (_cachedSessionId) return _cachedSessionId;
  try {
    const stored = await AsyncStorage.getItem(SESSION_ID_KEY);
    if (stored) {
      _cachedSessionId = stored;
      return stored;
    }
    const generated = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await AsyncStorage.setItem(SESSION_ID_KEY, generated);
    _cachedSessionId = generated;
    return generated;
  } catch {
    // AsyncStorage unavailable — fall back to a runtime-only ID.
    if (!_cachedSessionId) {
      _cachedSessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    return _cachedSessionId;
  }
}

// ── Internal logger — fire-and-forget POST to the analytics API ──────────────
// Never awaited by callers. A tracking failure must never surface to the user.
function logInternal(payload: {
  eventType: string;
  productId?: string | number | null;
  productName?: string | null;
  value?: number | null;
}): void {
  getSessionId()
    .then((sessionId) =>
      fetch(`${API_BASE_URL}/api/analytics/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          sessionId,
          platform: "mobile",
          // Tag all events as coming from the mobile app so traffic-sources
          // can break out web vs app attribution in the admin dashboard.
          utmSource: "mobile_app",
          utmMedium: "app",
        }),
      })
    )
    .catch(() => {});
}

// ── Type definitions ─────────────────────────────────────────────────────────
export interface ProductEventParams {
  id: string | number;
  name: string;
  price: number;
  category?: string | null;
  currency?: string;
}

export interface CheckoutEventParams {
  value: number;
  numItems?: number;
  currency?: string;
}

export interface PurchaseEventParams {
  orderId: string | number;
  value: number;
  currency?: string;
  items?: Array<{
    id: string | number;
    name: string;
    price: number;
    quantity: number;
  }>;
}

// ── ViewContent ───────────────────────────────────────────────────────────────
// Call when a product detail screen becomes visible.
export function trackViewContent(params: ProductEventParams): void {
  logInternal({
    eventType: "view_content",
    productId: params.id,
    productName: params.name,
    value: params.price,
  });
}

// ── AddToCart ─────────────────────────────────────────────────────────────────
// Call after a successful add-to-cart API response (not on button press,
// to avoid tracking failed/cancelled cart additions).
export function trackAddToCart(params: ProductEventParams & { quantity?: number }): void {
  const quantity = params.quantity ?? 1;
  logInternal({
    eventType: "add_to_cart",
    productId: params.id,
    productName: params.name,
    value: params.price * quantity,
  });
}

// ── InitiateCheckout ──────────────────────────────────────────────────────────
// Call once when the checkout screen mounts (not on every render).
export function trackInitiateCheckout(params: CheckoutEventParams): void {
  logInternal({
    eventType: "initiate_checkout",
    value: params.value,
  });
}

// ── Purchase ──────────────────────────────────────────────────────────────────
// Call inside createOrder's onSuccess callback, after the API confirms the order.
// Guard with a ref at the call site to prevent double-fire on re-mounts.
export function trackPurchase(params: PurchaseEventParams): void {
  logInternal({
    eventType: "purchase",
    value: params.value,
  });
}
