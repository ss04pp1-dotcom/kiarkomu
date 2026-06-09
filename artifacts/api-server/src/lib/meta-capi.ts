import crypto from "crypto";
import { logger } from "./logger.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizeBDPhoneToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(3);
  if (!digits.startsWith("0") && digits.length === 10) digits = "0" + digits;
  if (digits.startsWith("0")) digits = "880" + digits.slice(1);
  return digits.length >= 12 ? `+${digits}` : null;
}

// ── Public interface ───────────────────────────────────────────────────────────

export interface MetaCapiPurchaseParams {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  orderId: number | string;
  value: number;
  currency?: string;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  userName?: string | null;
}

/**
 * Fire a server-side Purchase event to Meta Conversions API.
 * This is intentionally fire-and-forget — it must never block or crash the checkout response.
 * The event_id is set to `order-{orderId}` so Meta can deduplicate against the
 * browser Pixel event which should use the same event_id.
 */
export function fireMetaCapiPurchase(params: MetaCapiPurchaseParams): void {
  const {
    pixelId, accessToken, testEventCode,
    orderId, value, currency = "BDT",
    clientIp, clientUserAgent,
    userEmail, userPhone, userName,
  } = params;

  if (!pixelId || !accessToken) return;

  const eventId = `order-${orderId}`;
  const eventTime = Math.floor(Date.now() / 1000);

  const userData: Record<string, any> = {};
  if (userEmail) userData.em = [sha256(userEmail)];
  const e164 = normalizeBDPhoneToE164(userPhone);
  if (e164) userData.ph = [sha256(e164)];
  if (userName) {
    const parts = userName.trim().toLowerCase().split(/\s+/);
    userData.fn = [sha256(parts[0] ?? "")];
    if (parts.length > 1) userData.ln = [sha256(parts[parts.length - 1])];
  }
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  const payload: Record<string, any> = {
    data: [{
      event_name: "Purchase",
      event_time: eventTime,
      event_id: eventId,
      action_source: "website",
      user_data: userData,
      custom_data: {
        value: parseFloat(value.toFixed(2)),
        currency,
        order_id: String(orderId),
      },
    }],
  };

  if (testEventCode) payload.test_event_code = testEventCode;

  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn({ orderId, status: res.status, body }, "Meta CAPI non-2xx response");
      }
    })
    .catch((err) => {
      logger.warn({ err, orderId }, "Meta CAPI network error (non-blocking)");
    });
}
