import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db } from "@workspace/db";
import { usersTable, notificationsTable, appSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken, generateReferralCode } from "../lib/auth.js";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { isDisposableEmail } from "../lib/disposable-domains.js";
import { storeVerificationCode, verifyCode, clearVerification, checkAndIncrementAttempt } from "../lib/verification-store.js";

const router = Router();

// ── Rate Limiters ──────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many login attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: "Too many verification email requests. Please wait before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Race a promise against a timeout */
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms)),
  ]);

/** Map mailer errors to user-friendly messages */
const resolveMailerError = (err: any): string => {
  const msg: string = err?.message ?? "";
  if (msg.includes("Invalid login") || msg.includes("BadCredentials") || msg.includes("535") || msg.includes("Username and Password"))
    return "Email service is not configured correctly. Please ask the shop admin to set up a valid Gmail App Password in Settings.";
  if (msg.includes("not configured") || msg.includes("SMTP credentials"))
    return "Email service is not set up yet. Please ask the shop admin to configure email settings.";
  if (msg.includes("timed out"))
    return "Email server is taking too long. Please try again in a moment.";
  return "Failed to send email. Please try again later.";
};

/** Sanitized user shape — never exposes passwordHash, resetToken, pushToken, etc. */
const publicUser = (user: any) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone ?? null,
  avatarUrl: user.avatarUrl ?? null,
  gender: user.gender ?? null,
  birthday: user.birthday ?? null,
  role: user.role,
  referralCode: user.referralCode,
  permissions: user.permissions ?? null,
  createdAt: user.createdAt.toISOString(),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

// POST /auth/send-verification
// Sends a 6-digit OTP to the given email.
// Guards: regex format, Gmail local-part length, MX record, disposable check, DB rate limit (2/12h).
// Email is sent as a background task so the client gets an instant response.
router.post("/auth/send-verification", sendVerificationLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  const normalized = email.trim().toLowerCase();

  // 1. Regex format validation
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!EMAIL_REGEX.test(normalized)) {
    res.status(400).json({ error: "Invalid email address format." });
    return;
  }

  const atIndex = normalized.indexOf("@");
  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  // 2. Gmail minimum local-part length (blocks a@gmail.com, ab@gmail.com, etc.)
  if (domain === "gmail.com" && localPart.length < 6) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  // 3. Disposable email check
  if (isDisposableEmail(normalized)) {
    res.status(400).json({ error: "Temporary or disposable email addresses are not allowed. Please use a real email." });
    return;
  }

  // 4. MX record check — confirms the domain can actually receive email
  try {
    const dns = await import("dns");
    const mxRecords = await dns.promises.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      res.status(400).json({ error: "This email domain does not appear to accept email. Please use a valid email address." });
      return;
    }
  } catch {
    res.status(400).json({ error: "This email domain does not appear to accept email. Please use a valid email address." });
    return;
  }

  // 5. Reject already-registered emails — no OTP should be sent if an account exists
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalized)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email is already registered. Please log in or use Forgot Password." });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "send-verification existing-user check failed");
    res.status(500).json({ error: "Failed to process request. Please try again later." });
    return;
  }

  // 6. DB-based rate limit: 2 requests per 12-hour window per email address
  try {
    const rateResult = await checkAndIncrementAttempt(normalized);
    if (!rateResult.allowed) {
      const totalSeconds = Math.ceil(rateResult.remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.ceil((totalSeconds % 3600) / 60);
      const parts: string[] = [];
      if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
      if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
      res.status(429).json({ error: `Verification limit reached. Try again in ${parts.join(" ")}.` });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "send-verification rate-limit check failed");
    res.status(500).json({ error: "Failed to process request. Please try again later." });
    return;
  }

  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await storeVerificationCode(normalized, code);

    // Respond immediately — job is queued for background delivery with automatic retries
    res.json({ message: "Verification code sent to your email." });

    import("../lib/job-queue.js")
      .then(({ enqueueJob }) => enqueueJob("email:verification", { to: normalized, code }))
      .catch((err: unknown) => req.log.error({ err }, "send-verification enqueue failed"));
  } catch (err: any) {
    req.log.error({ err }, "send-verification failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process request. Please try again later." });
    }
  }
});

// POST /auth/verify-email-code
router.post("/auth/verify-email-code", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) { res.status(400).json({ error: "Email and code are required" }); return; }

  try {
    const result = await verifyCode(email.trim().toLowerCase(), code.trim());
    if (result === "expired") { res.status(400).json({ error: "Code has expired. Please request a new one." }); return; }
    if (result === "invalid") { res.status(400).json({ error: "Invalid code. Please check and try again." }); return; }
    res.json({ message: "Email verified successfully." });
  } catch (err) {
    req.log.error({ err }, "verify-email-code failed");
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// ── Google ID-token verifier ─────────────────────────────────────────────────
// Verifies the idToken returned by @react-native-google-signin/google-signin
// using google-auth-library. Falls back to unsigned JWT parsing when no
// webClientId is configured in the Admin Panel settings.
async function verifyGoogleIdToken(
  idToken: string
): Promise<{ email: string; name: string; sub: string; picture?: string } | null> {
  try {
    const [settings] = await db
      .select({ googleClientId: appSettingsTable.googleClientId })
      .from(appSettingsTable)
      .limit(1);

    const clientId = settings?.googleClientId;

    if (clientId) {
      const { OAuth2Client } = await import("google-auth-library");
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload?.sub) return null;
      return {
        email: payload.email,
        name: payload.name ?? payload.email.split("@")[0],
        sub: payload.sub,
        picture: payload.picture,
      };
    }

    // No clientId configured — refuse the token rather than parse it without cryptographic verification.
    // Configure a Google Web Client ID in Admin → Settings → Google to enable Google Sign-In.
    return null;
  } catch {
    return null;
  }
}

// POST /auth/google
router.post("/auth/google", async (req, res) => {
  const { idToken } = req.body;

  let email: string;
  let name: string;
  let googleId: string;
  let avatarUrl: string | undefined;

  if (idToken) {
    // Native flow: idToken from @react-native-google-signin/google-signin
    const profile = await verifyGoogleIdToken(idToken);
    if (!profile) {
      res.status(401).json({ error: "Invalid Google ID token. Please try again." });
      return;
    }
    email = profile.email;
    name = profile.name;
    googleId = profile.sub;
    avatarUrl = profile.picture;
  } else {
    res.status(400).json({ error: "idToken required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  req.log.info({ email: normalizedEmail }, "Google auth attempt");

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
    let user: any;

    if (existing.length > 0) {
      [user] = await db
        .update(usersTable)
        .set({ ...(avatarUrl && !existing[0].avatarUrl ? { avatarUrl } : {}), updatedAt: new Date() })
        .where(eq(usersTable.id, existing[0].id))
        .returning();
      req.log.info({ userId: user.id }, "Google auth: existing user logged in");
    } else {
      const adminEmail = process.env["INITIAL_ADMIN_EMAIL"]?.trim().toLowerCase();
      const assignedRole = adminEmail && normalizedEmail === adminEmail ? "owner" : "customer";
      req.log.info({ normalizedEmail, assignedRole }, "Google auth: creating new user");

      let inserted = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          [user] = await db.insert(usersTable).values({
            name: name?.trim() || normalizedEmail.split("@")[0],
            email: normalizedEmail,
            passwordHash: `google:${googleId}`,
            referralCode: generateReferralCode(),
            avatarUrl: avatarUrl ?? null,
            role: assignedRole,
          }).returning();
          inserted = true;
          break;
        } catch (insertErr: any) {
          // Log every insert failure with full detail so the real cause is visible in Render logs
          req.log.error(
            { attempt, errCode: insertErr?.code, errConstraint: insertErr?.constraint, errMsg: insertErr?.message },
            "Google auth: insert attempt failed"
          );
          if (insertErr?.code === "23505" && insertErr?.constraint?.includes("referral_code") && attempt < 2) continue;
          throw insertErr;
        }
      }
      if (!inserted || !user) throw new Error("Failed to create user after 3 retries — check logs above for DB error");

      if (assignedRole !== "owner") {
        const [wSettings] = await db.select({ welcomeCouponCode: appSettingsTable.welcomeCouponCode }).from(appSettingsTable).limit(1);
        const couponPart = wSettings?.welcomeCouponCode ? ` Use code ${wSettings.welcomeCouponCode} for 10% off your first order.` : "";
        await db.insert(notificationsTable).values({
          userId: user.id,
          title: "Welcome to Shohure!",
          body: `Thanks for joining!${couponPart}`,
          type: "general",
          read: false,
        }).catch((err) => req.log.warn({ err, userId: user.id }, "Welcome notification failed (Google)"));
      }
      req.log.info({ userId: user.id, assignedRole }, "Google auth: new user created successfully");
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({ user: publicUser(user), token });
  } catch (err: any) {
    // Full error detail in log — this is what reveals the real loop cause
    req.log.error({ errCode: err?.code, errConstraint: err?.constraint, errMsg: err?.message, stack: err?.stack }, "Google auth fatal error");
    res.status(500).json({ error: "Google sign-in failed. Please try again." });
  }
});

// POST /auth/register
router.post("/auth/register", async (req, res) => {
  const { name, email, password, phone, referralCode, verificationCode } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    res.status(400).json({ error: "Password must contain at least one uppercase letter and one number" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (isDisposableEmail(normalizedEmail)) {
    res.status(400).json({ error: "Temporary or disposable email addresses are not allowed." });
    return;
  }

  if (!verificationCode) {
    res.status(400).json({ error: "Email verification is required. Please verify your email first." });
    return;
  }

  try {
    const codeResult = await verifyCode(normalizedEmail, verificationCode.trim());
    if (codeResult === "expired") { res.status(400).json({ error: "Verification code has expired. Please request a new one." }); return; }
    if (codeResult === "invalid") { res.status(400).json({ error: "Invalid verification code. Please check and try again." }); return; }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "This email is already in use." }); return; }

    const adminEmail = process.env["INITIAL_ADMIN_EMAIL"]?.trim().toLowerCase();
    const assignedRole = adminEmail && normalizedEmail === adminEmail ? "owner" : "customer";

    const [user] = await db.insert(usersTable).values({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      phone: phone || null,
      referralCode: generateReferralCode(),
      role: assignedRole,
    }).returning();

    // Referral bonus — wrapped in a transaction so coins are atomic
    if (referralCode) {
      const referrer = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode)).limit(1);
      if (referrer.length > 0) {
        try {
          const { referralsTable, userCoinsTable, coinTransactionsTable } = await import("@workspace/db");
          const { sql } = await import("drizzle-orm");
          await db.transaction(async (tx) => {
            await tx.insert(referralsTable).values({ referrerId: referrer[0].id, referredId: user.id, coinsAwarded: 50 });
            for (const uid of [referrer[0].id, user.id]) {
              await tx.insert(userCoinsTable).values({ userId: uid, balance: 50 })
                .onConflictDoUpdate({ target: userCoinsTable.userId, set: { balance: sql`user_coins.balance + 50` } });
              await tx.insert(coinTransactionsTable).values({ userId: uid, type: "referral", amount: 50, description: "Referral bonus" });
            }
          });
        } catch (refErr) {
          req.log.warn({ err: refErr, referralCode, userId: user.id }, "Referral bonus failed — coins not awarded");
        }
      }
    }

    await clearVerification(normalizedEmail);

    if (assignedRole !== "owner") {
      const [wSettings] = await db.select({ welcomeCouponCode: appSettingsTable.welcomeCouponCode }).from(appSettingsTable).limit(1);
      const couponPart = wSettings?.welcomeCouponCode ? ` Use code ${wSettings.welcomeCouponCode} for 10% off your first order.` : "";
      await db.insert(notificationsTable).values({
        userId: user.id,
        title: "Welcome to Shohure!",
        body: `Thanks for joining!${couponPart}`,
        type: "general",
        read: false,
      }).catch((err) => req.log.warn({ err, userId: user.id }, "Welcome notification failed (register)"));
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({ user: publicUser(user), token });
  } catch (err: any) {
    req.log.error({ err }, "Registration error");
    if (err?.code === "23505") {
      res.status(400).json({ error: "This email is already in use." });
      return;
    }
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// POST /auth/forgot-password
// Returns 404 if no account exists — callers must create an account first.
// Reset email is sent as a background task for an instant response.
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);

    if (!user) {
      res.status(404).json({ error: "No account found with this email. Please create an account." });
      return;
    }
    if (user.passwordHash.startsWith("google:")) {
      res.status(400).json({ error: "This account uses Google Sign-In. Please log in with Google." });
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.update(usersTable)
      .set({ resetToken: code, resetTokenExpiry: new Date(Date.now() + 15 * 60_000), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    // Respond immediately — job is queued for background delivery with automatic retries
    res.json({ message: "Reset code sent to your email." });

    Promise.all([
      import("../lib/job-queue.js"),
      db.select({ siteName: appSettingsTable.siteName }).from(appSettingsTable).limit(1),
    ]).then(([{ enqueueJob }, settings]) => {
      const siteName = settings[0]?.siteName ?? "Shohure";
      enqueueJob("email:password-reset", { to: user.email, code, siteName }).catch((err: unknown) => {
        req.log.error({ err }, "forgot-password enqueue failed");
      });
    }).catch((err: unknown) => {
      req.log.error({ err }, "forgot-password background setup failed");
    });
  } catch (err) {
    req.log.error({ err }, "forgot-password error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process request. Please try again later." });
    }
  }
});

// POST /auth/reset-password
router.post("/auth/reset-password", loginLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) { res.status(400).json({ error: "email, code, and newPassword are required" }); return; }
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    res.status(400).json({ error: "Password must be at least 8 characters with an uppercase letter and a number" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase())).limit(1);
  if (!user || user.resetToken !== code) { res.status(400).json({ error: "Invalid or expired code" }); return; }
  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    res.status(400).json({ error: "Code has expired. Please request a new one." });
    return;
  }

  await db.update(usersTable)
    .set({ passwordHash: await hashPassword(newPassword), resetToken: null, resetTokenExpiry: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password reset successfully." });
});

// POST /auth/login
router.post("/auth/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Email and password are required" }); return; }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase())).limit(1);
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }

    // Check Google-only BEFORE verifyPassword to give a helpful message
    if (user.passwordHash.startsWith("google:")) {
      res.status(401).json({ error: "This account uses Google Sign-In. Please log in with Google." });
      return;
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({ user: publicUser(user), token });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// POST /auth/logout  (stateless JWT — client drops the token)
router.post("/auth/logout", (_req, res) => {
  res.json({ success: true });
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(publicUser(user));
  } catch (err) {
    req.log.error({ err }, "GET /auth/me error");
    res.status(500).json({ error: "Failed to fetch user." });
  }
});

// PATCH /auth/me  — update name, phone, avatar, pushToken, gender, birthday
router.patch("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const { name, phone, avatarUrl, pushToken, gender, birthday } = req.body;
  if (avatarUrl !== undefined && avatarUrl !== null) {
    const trimmedUrl = String(avatarUrl).trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      res.status(400).json({ error: "avatarUrl must be a valid http or https URL" });
      return;
    }
  }
  const VALID_GENDERS = ["male", "female", "other"];
  if (gender !== undefined && gender !== null && !VALID_GENDERS.includes(gender)) {
    res.status(400).json({ error: "gender must be male, female, or other" });
    return;
  }
  try {
    const [updated] = await db
      .update(usersTable)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(pushToken !== undefined && { pushToken }),
        ...(gender !== undefined && { gender }),
        ...(birthday !== undefined && { birthday: birthday || null }),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, req.userId!))
      .returning();

    res.json(publicUser(updated));
  } catch (err) {
    req.log.error({ err }, "PATCH /auth/me error");
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// POST /auth/change-email
router.post("/auth/change-email", requireAuth, async (req: AuthRequest, res) => {
  const { currentPassword, newEmail } = req.body;
  if (!currentPassword || !newEmail) { res.status(400).json({ error: "currentPassword and newEmail are required" }); return; }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (user.passwordHash.startsWith("google:")) {
      res.status(400).json({ error: "This account uses Google Sign-In and cannot change email this way." });
      return;
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const normalized = newEmail.trim().toLowerCase();
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalized)).limit(1);
    if (existing) { res.status(400).json({ error: "This email is already in use by another account" }); return; }

    await db.update(usersTable).set({ email: normalized, updatedAt: new Date() }).where(eq(usersTable.id, req.userId!));
    res.json({ message: "Email changed successfully." });
  } catch (err) {
    req.log.error({ err }, "change-email error");
    res.status(500).json({ error: "Failed to change email." });
  }
});

// DELETE /auth/me — permanently delete own account
router.delete("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    // Delete in order: dependent rows first, then the user
    await db.execute(sql`DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = ${userId})`);
    await db.execute(sql`DELETE FROM carts WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM addresses WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM coin_transactions WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM push_tokens WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ${userId})`);
    await db.execute(sql`DELETE FROM orders WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    res.json({ message: "Account deleted successfully." });
  } catch (err) {
    req.log.error({ err }, "delete-account error");
    res.status(500).json({ error: "Failed to delete account." });
  }
});

// POST /auth/change-password
router.post("/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "currentPassword and newPassword are required" }); return; }
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    res.status(400).json({ error: "New password must be at least 8 characters and contain at least one uppercase letter and one number" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.passwordHash.startsWith("google:")) {
      res.status(400).json({ error: "This account uses Google Sign-In and does not have a password." });
      return;
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    await db.update(usersTable)
      .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(usersTable.id, req.userId!));

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    req.log.error({ err }, "change-password error");
    res.status(500).json({ error: "Failed to change password." });
  }
});

export default router;