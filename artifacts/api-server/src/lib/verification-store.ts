import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const TTL_MS = 15 * 60 * 1000; // 15 minutes
const RATE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_ATTEMPTS = 2;

// ── Rate limiting ────────────────────────────────────────────────────────────

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; remainingMs: number };

/**
 * Checks whether the email is within the 2-per-12-hour send limit.
 * If allowed, increments the attempt counter (or resets a stale window).
 * Always ensures a row exists in email_verifications before returning.
 */
export async function checkAndIncrementAttempt(email: string): Promise<RateLimitResult> {
  const key = email.toLowerCase();

  const res = await db.execute(sql`
    SELECT attempts, first_attempt_at
    FROM email_verifications
    WHERE email = ${key}
    LIMIT 1
  `);

  const row = res.rows[0] as { attempts: number; first_attempt_at: string | null } | undefined;

  if (row && row.first_attempt_at) {
    const windowStart = new Date(row.first_attempt_at).getTime();
    const elapsed = Date.now() - windowStart;

    if (elapsed < RATE_WINDOW_MS) {
      // Still inside the 12-hour window
      if (row.attempts >= MAX_ATTEMPTS) {
        return { allowed: false, remainingMs: RATE_WINDOW_MS - elapsed };
      }
      // Under the limit — increment
      await db.execute(sql`
        UPDATE email_verifications
        SET attempts = attempts + 1
        WHERE email = ${key}
      `);
      return { allowed: true };
    }
    // Window has expired — reset counter for a fresh window
    await db.execute(sql`
      UPDATE email_verifications
      SET attempts = 1, first_attempt_at = NOW()
      WHERE email = ${key}
    `);
    return { allowed: true };
  }

  // No record yet (or record without a window start) — create/reset with attempts = 1
  await db.execute(sql`
    INSERT INTO email_verifications (email, code, expires_at, verified, attempts, first_attempt_at)
    VALUES (${key}, '', NOW(), false, 1, NOW())
    ON CONFLICT (email) DO UPDATE
      SET attempts = 1, first_attempt_at = NOW()
  `);
  return { allowed: true };
}

// ── Code storage & verification ──────────────────────────────────────────────

/**
 * Stores a new verification code for the email.
 * Intentionally does NOT reset attempts or first_attempt_at so rate limits persist.
 */
export async function storeVerificationCode(email: string, code: string): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.execute(sql`
    INSERT INTO email_verifications (email, code, expires_at, verified, attempts, first_attempt_at)
    VALUES (${email.toLowerCase()}, ${code}, ${expiresAt.toISOString()}, false, 1, NOW())
    ON CONFLICT (email) DO UPDATE
      SET code       = EXCLUDED.code,
          expires_at = EXCLUDED.expires_at,
          verified   = false
  `);
}

export async function verifyCode(email: string, code: string): Promise<"ok" | "invalid" | "expired"> {
  const result = await db.execute(sql`
    SELECT code, expires_at, verified
    FROM email_verifications
    WHERE email = ${email.toLowerCase()}
    LIMIT 1
  `);

  const row = result.rows[0] as any;
  if (!row) return "invalid";

  const expiresAt = new Date(row.expires_at);
  if (expiresAt < new Date()) {
    await db.execute(sql`DELETE FROM email_verifications WHERE email = ${email.toLowerCase()}`);
    return "expired";
  }

  if (row.code !== code) return "invalid";

  await db.execute(sql`
    UPDATE email_verifications SET verified = true WHERE email = ${email.toLowerCase()}
  `);
  return "ok";
}

export async function isVerified(email: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT verified FROM email_verifications
    WHERE email = ${email.toLowerCase()} AND expires_at > NOW()
    LIMIT 1
  `);
  const row = result.rows[0] as any;
  return !!row?.verified;
}

export async function clearVerification(email: string): Promise<void> {
  await db.execute(sql`DELETE FROM email_verifications WHERE email = ${email.toLowerCase()}`);
}
