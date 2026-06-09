// ── In-memory rate-limit store ────────────────────────────────────────────────
// Tracks recent order attempts per IP and per userId.
// Entries are pruned lazily: any entry older than WINDOW_MS is treated as expired.
// This is intentionally NOT Redis-backed — it is a lightweight first-pass guard;
// a Redis-based solution would be needed for multi-instance deployments.

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ORDERS = 2;             // max orders allowed in the window

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
}

const ipStore = new Map<string, RateLimitEntry>();
const userStore = new Map<string, RateLimitEntry>();

function recordAttempt(store: Map<string, RateLimitEntry>, key: string): { exceeded: boolean } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { attempts: 1, windowStart: now });
    return { exceeded: false };
  }

  entry.attempts += 1;
  return { exceeded: entry.attempts > MAX_ORDERS };
}

// ── Phone validation ──────────────────────────────────────────────────────────
// Valid BD mobile: 01[3-9]\d{8} (11 digits total).
// Fake pattern: any digit repeating 6 or more consecutive times.

const VALID_BD_PHONE = /^01[3-9]\d{8}$/;
const REPEATING_DIGITS = /(.)\1{5,}/; // 6+ consecutive identical chars

export function isPhoneValid(raw: string | null | undefined): boolean {
  if (!raw) return true; // no phone to validate — skip
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.startsWith("880") ? "0" + digits.slice(3) : digits;
  if (!VALID_BD_PHONE.test(normalized)) return false;
  if (REPEATING_DIGITS.test(normalized)) return false;
  return true;
}

// ── Main fraud check ──────────────────────────────────────────────────────────

export interface FraudCheckInput {
  ip: string | null;
  userId: number | string;
  phone?: string | null;
}

export interface FraudCheckResult {
  isFraud: boolean;
  reason?: string;
}

export function checkFraud(input: FraudCheckInput): FraudCheckResult {
  const { ip, userId, phone } = input;

  if (ip) {
    const { exceeded } = recordAttempt(ipStore, ip);
    if (exceeded) {
      return { isFraud: true, reason: "rate_limit_ip" };
    }
  }

  const { exceeded: userExceeded } = recordAttempt(userStore, String(userId));
  if (userExceeded) {
    return { isFraud: true, reason: "rate_limit_user" };
  }

  if (!isPhoneValid(phone)) {
    return { isFraud: true, reason: "invalid_phone" };
  }

  return { isFraud: false };
}
