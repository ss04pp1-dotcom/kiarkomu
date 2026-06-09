import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable, usersTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/requireAuth.js";
import { carrybeeGetStores } from "../lib/carrybee.js";
import { sendTestEmail } from "../lib/mailer.js";

const router = Router();

router.get("/config", async (_req, res) => {
  const [settings] = await db.select().from(appSettingsTable).limit(1);
  res.json({
    // Named googleWebClientId to match the AppConfigSafe interface in the mobile app
    googleWebClientId: settings?.googleClientId ?? null,
    googleAndroidClientId: settings?.googleAndroidClientId ?? null,
    googleIosClientId: settings?.googleIosClientId ?? null,
    whatsappNumber: settings?.whatsappNumber ?? null,
    bkashNumber: settings?.bkashNumber ?? null,
    nagadNumber: settings?.nagadNumber ?? null,
    rocketNumber: settings?.rocketNumber ?? null,
    primaryColor: settings?.primaryColor ?? null,
    siteName: settings?.siteName ?? null,
    // Payment method flags
    codEnabled: settings?.codEnabled ?? true,
    bkashEnabled: settings?.bkashEnabled ?? true,
    nagadEnabled: settings?.nagadEnabled ?? true,
    rocketEnabled: settings?.rocketEnabled ?? true,
    cardEnabled: settings?.cardEnabled ?? true,
    payDeliveryChargeEnabled: settings?.payDeliveryChargeEnabled ?? false,
    // Legal URLs
    privacyPolicyUrl: settings?.privacyPolicyUrl ?? null,
    termsOfServiceUrl: settings?.termsOfServiceUrl ?? null,
    // Payment logos and labels
    bkashLogoUrl: settings?.bkashLogoUrl ?? null,
    nagadLogoUrl: settings?.nagadLogoUrl ?? null,
    rocketLogoUrl: settings?.rocketLogoUrl ?? null,
    bkashNumberLabel: settings?.bkashNumberLabel ?? "bKash Number",
    nagadNumberLabel: settings?.nagadNumberLabel ?? "Nagad Number",
    rocketNumberLabel: settings?.rocketNumberLabel ?? "Rocket Number",
    bkashTxnLabel: settings?.bkashTxnLabel ?? "Transaction ID (TrxID)",
    nagadTxnLabel: settings?.nagadTxnLabel ?? "Transaction ID (TrxID)",
    rocketTxnLabel: settings?.rocketTxnLabel ?? "Transaction ID (TrxID)",
    // Free delivery
    enableFreeDelivery: settings?.enableFreeDelivery ?? true,
    freeDeliveryThreshold: settings ? parseFloat(settings.freeDeliveryThreshold) : 500,
    // Web announcement ticker
    webAnnouncementText: settings?.webAnnouncementText ?? null,
    webAnnouncementActive: settings?.webAnnouncementActive ?? true,
  });
});

router.get("/settings", requireAuth, requireRole("owner", "manager"), async (_req, res) => {
  let [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(appSettingsTable).values({}).returning();
  }
  const { smtpPassword: _hidden, googleClientSecret: _hiddenSecret, ...safeSettings } = settings;
  res.json({
    ...safeSettings,
    enableFreeDelivery: settings.enableFreeDelivery,
    freeDeliveryThreshold: parseFloat(settings.freeDeliveryThreshold),
    coinValue: parseFloat(settings.coinValue),
    smtpConfigured: !!(settings.smtpEmail && settings.smtpPassword),
    smtpHost: settings.smtpHost ?? null,
    smtpPort: settings.smtpPort ?? null,
    smtpSecure: settings.smtpSecure ?? false,
    googleConfigured: !!(settings.googleClientId && settings.googleClientSecret),
    googleIosClientId: settings.googleIosClientId ?? null,
    bkashEnabled: settings.bkashEnabled,
    nagadEnabled: settings.nagadEnabled,
    rocketEnabled: settings.rocketEnabled,
    codEnabled: settings.codEnabled,
    cardEnabled: settings.cardEnabled ?? true,
    payDeliveryChargeEnabled: settings.payDeliveryChargeEnabled ?? false,
    privacyPolicyUrl: settings.privacyPolicyUrl ?? null,
    termsOfServiceUrl: settings.termsOfServiceUrl ?? null,
    notificationRetentionDays: settings.notificationRetentionDays ?? 7,
    bkashLogoUrl: settings.bkashLogoUrl ?? null,
    nagadLogoUrl: settings.nagadLogoUrl ?? null,
    rocketLogoUrl: settings.rocketLogoUrl ?? null,
    bkashNumberLabel: settings.bkashNumberLabel ?? "bKash Number",
    nagadNumberLabel: settings.nagadNumberLabel ?? "Nagad Number",
    rocketNumberLabel: settings.rocketNumberLabel ?? "Rocket Number",
    bkashTxnLabel: settings.bkashTxnLabel ?? "Transaction ID (TrxID)",
    nagadTxnLabel: settings.nagadTxnLabel ?? "Transaction ID (TrxID)",
    rocketTxnLabel: settings.rocketTxnLabel ?? "Transaction ID (TrxID)",
    steadfastEnabled: settings.steadfastEnabled ?? false,
    carrybeeEnabled: settings.carrybeeEnabled ?? false,
    courierAutoSubmit: settings.courierAutoSubmit ?? false,
    activeCourier: settings.activeCourier ?? null,
    carrybeeMode: settings.carrybeeMode ?? "sandbox",
    carrybeeClientId: settings.carrybeeClientId ?? null,
    carrybeeClientContext: settings.carrybeeClientContext ?? null,
    carrybeeStoreId: settings.carrybeeStoreId ?? null,
    welcomeCouponCode: settings.welcomeCouponCode ?? null,
  });
});

router.post("/settings/smtp/test", requireAuth, requireRole("owner"), async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);
    if (!user?.email) {
      res.status(400).json({ error: "Could not find your account email address." });
      return;
    }
    await sendTestEmail(user.email);
    res.json({ message: `Test email sent to ${user.email}` });
  } catch (err: any) {
    req.log.error({ err }, "SMTP test send failed");
    res.status(500).json({ error: err.message || "Failed to send test email. Check your SMTP settings and try again." });
  }
});

async function upsertSettings(update: any) {
  const [existing] = await db.select().from(appSettingsTable).limit(1);
  if (existing) {
    const [updated] = await db.update(appSettingsTable).set(update).where(eq(appSettingsTable.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(appSettingsTable).values(update).returning();
  return created;
}

router.patch("/settings", requireAuth, requireRole("owner"), async (req, res) => {
  const body = req.body;
  const update: any = {};
  if (body.siteName !== undefined) update.siteName = body.siteName;
  if (body.logoUrl !== undefined) update.logoUrl = body.logoUrl;
  if (body.defaultLanguage !== undefined) update.defaultLanguage = body.defaultLanguage;
  if (body.enableFreeDelivery !== undefined) update.enableFreeDelivery = body.enableFreeDelivery;
  if (body.freeDeliveryThreshold !== undefined) update.freeDeliveryThreshold = body.freeDeliveryThreshold.toString();
  if (body.coinValue !== undefined) update.coinValue = body.coinValue.toString();
  if (body.sslcommerzStoreId !== undefined) update.sslcommerzStoreId = body.sslcommerzStoreId;
  if (body.sslcommerzStorePassword !== undefined) update.sslcommerzStorePassword = body.sslcommerzStorePassword;
  if (body.sslcommerzSandbox !== undefined) update.sslcommerzSandbox = body.sslcommerzSandbox;
  if (body.promoCardsJson !== undefined) update.promoCardsJson = body.promoCardsJson;
  if (body.primaryColor !== undefined) update.primaryColor = body.primaryColor;
  if (body.smtpEmail !== undefined) update.smtpEmail = body.smtpEmail;
  if (body.smtpPassword !== undefined && body.smtpPassword !== "") update.smtpPassword = body.smtpPassword;
  if (body.smtpHost !== undefined) update.smtpHost = body.smtpHost || null;
  if (body.smtpPort !== undefined) update.smtpPort = body.smtpPort ? Number(body.smtpPort) : null;
  if (body.smtpSecure !== undefined) update.smtpSecure = !!body.smtpSecure;
  if (body.googleClientId !== undefined) update.googleClientId = body.googleClientId || null;
  if (body.googleClientSecret !== undefined && body.googleClientSecret !== "") update.googleClientSecret = body.googleClientSecret;
  if (body.googleAndroidClientId !== undefined) update.googleAndroidClientId = body.googleAndroidClientId || null;
  if (body.googleIosClientId !== undefined) update.googleIosClientId = body.googleIosClientId || null;
  if (body.whatsappNumber !== undefined) update.whatsappNumber = body.whatsappNumber || null;
  if (body.bkashNumber !== undefined) update.bkashNumber = body.bkashNumber || null;
  if (body.nagadNumber !== undefined) update.nagadNumber = body.nagadNumber || null;
  if (body.rocketNumber !== undefined) update.rocketNumber = body.rocketNumber || null;
  if (body.bkashEnabled !== undefined) update.bkashEnabled = body.bkashEnabled;
  if (body.nagadEnabled !== undefined) update.nagadEnabled = body.nagadEnabled;
  if (body.rocketEnabled !== undefined) update.rocketEnabled = body.rocketEnabled;
  if (body.codEnabled !== undefined) update.codEnabled = body.codEnabled;
  if (body.cardEnabled !== undefined) update.cardEnabled = body.cardEnabled;
  if (body.payDeliveryChargeEnabled !== undefined) update.payDeliveryChargeEnabled = body.payDeliveryChargeEnabled;
  if (body.bkashLogoUrl !== undefined) update.bkashLogoUrl = body.bkashLogoUrl || null;
  if (body.nagadLogoUrl !== undefined) update.nagadLogoUrl = body.nagadLogoUrl || null;
  if (body.rocketLogoUrl !== undefined) update.rocketLogoUrl = body.rocketLogoUrl || null;
  if (body.bkashNumberLabel !== undefined) update.bkashNumberLabel = body.bkashNumberLabel || "bKash Number";
  if (body.nagadNumberLabel !== undefined) update.nagadNumberLabel = body.nagadNumberLabel || "Nagad Number";
  if (body.rocketNumberLabel !== undefined) update.rocketNumberLabel = body.rocketNumberLabel || "Rocket Number";
  if (body.bkashTxnLabel !== undefined) update.bkashTxnLabel = body.bkashTxnLabel || "Transaction ID (TrxID)";
  if (body.nagadTxnLabel !== undefined) update.nagadTxnLabel = body.nagadTxnLabel || "Transaction ID (TrxID)";
  if (body.rocketTxnLabel !== undefined) update.rocketTxnLabel = body.rocketTxnLabel || "Transaction ID (TrxID)";
  // Legal URLs
  if (body.privacyPolicyUrl !== undefined) update.privacyPolicyUrl = body.privacyPolicyUrl || null;
  if (body.termsOfServiceUrl !== undefined) update.termsOfServiceUrl = body.termsOfServiceUrl || null;
  // Cleanup retention
  if (body.notificationRetentionDays !== undefined) {
    const days = parseInt(body.notificationRetentionDays, 10);
    if (!isNaN(days) && days >= 1) update.notificationRetentionDays = days;
  }
  // Courier settings
  if (body.steadfastEnabled !== undefined) update.steadfastEnabled = body.steadfastEnabled;
  if (body.carrybeeEnabled !== undefined) update.carrybeeEnabled = body.carrybeeEnabled;
  if (body.courierAutoSubmit !== undefined) update.courierAutoSubmit = body.courierAutoSubmit;
  if (body.activeCourier !== undefined) update.activeCourier = body.activeCourier || null;
  if (body.carrybeeMode !== undefined) update.carrybeeMode = body.carrybeeMode || "sandbox";
  if (body.carrybeeClientId !== undefined) update.carrybeeClientId = body.carrybeeClientId || null;
  if (body.carrybeeClientSecret !== undefined && body.carrybeeClientSecret !== "") update.carrybeeClientSecret = body.carrybeeClientSecret;
  if (body.carrybeeClientContext !== undefined) update.carrybeeClientContext = body.carrybeeClientContext || null;
  if (body.carrybeeStoreId !== undefined) update.carrybeeStoreId = body.carrybeeStoreId || null;
  if (body.welcomeCouponCode !== undefined) update.welcomeCouponCode = body.welcomeCouponCode?.trim() || null;
  // Web announcement ticker
  if (body.webAnnouncementText !== undefined) update.webAnnouncementText = body.webAnnouncementText?.trim() || null;
  if (body.webAnnouncementActive !== undefined) update.webAnnouncementActive = !!body.webAnnouncementActive;
  // Tracking & Retargeting
  if (body.facebookPixelId !== undefined) update.facebookPixelId = body.facebookPixelId?.trim() || null;
  if (body.googleTagId !== undefined) update.googleTagId = body.googleTagId?.trim() || null;

  if (!Object.keys(update).length) {
    res.status(400).json({ error: "No valid fields provided to update" });
    return;
  }

  const updated = await upsertSettings(update);
  const { googleClientSecret: _gs, smtpPassword: _sp, ...safeUpdated } = updated;
  res.json({
    ...safeUpdated,
    freeDeliveryThreshold: parseFloat(updated.freeDeliveryThreshold),
    coinValue: parseFloat(updated.coinValue),
    googleConfigured: !!(updated.googleClientId && updated.googleClientSecret),
    smtpConfigured: !!(updated.smtpEmail && updated.smtpPassword),
  });
});

// Carrybee stores lookup — uses current saved settings so credentials don't need to be re-entered
router.get("/carrybee/stores", requireAuth, requireRole("owner", "manager"), async (_req, res) => {
  const [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings?.carrybeeEnabled) {
    res.status(400).json({ error: "Carrybee is not enabled" });
    return;
  }
  const stores = await carrybeeGetStores({
    carrybeeMode: settings.carrybeeMode,
    carrybeeClientId: settings.carrybeeClientId,
    carrybeeClientSecret: settings.carrybeeClientSecret,
    carrybeeClientContext: settings.carrybeeClientContext,
    carrybeeStoreId: settings.carrybeeStoreId,
  });
  if (!stores) {
    res.status(502).json({ error: "Failed to fetch stores from Carrybee. Check your credentials and try again." });
    return;
  }
  res.json({ stores });
});

// Users management
router.get("/users", requireAuth, requireRole("owner"), async (req, res) => {
  const { page = "1" } = req.query as any;
  const pageNum = parseInt(page);
  const limit = 20;
  const offset = (pageNum - 1) * limit;
  const users = await db.select().from(usersTable).limit(limit).offset(offset).orderBy(usersTable.createdAt);
  const [{ total }] = await db.select({ total: sql<number>`cast(count(*) as int)` }).from(usersTable);
  res.json({ users: users.map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, avatarUrl: u.avatarUrl, role: u.role, referralCode: u.referralCode, createdAt: u.createdAt.toISOString() })), total, page: pageNum });
});

router.patch("/users/:id/role", requireAuth, requireRole("owner"), async (req, res) => {
  const validRoles = ["owner", "manager", "customer"];
  if (!validRoles.includes(req.body.role)) {
    res.status(400).json({ error: "Invalid role. Must be owner, manager, or customer" });
    return;
  }
  const userId = parseInt(String(req.params.id), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  await db.update(usersTable).set({ role: req.body.role }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

router.get("/users/:id/permissions", requireAuth, requireRole("owner"), async (req, res) => {
  const userId = parseInt(String(req.params.id), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const [user] = await db.select({ permissions: usersTable.permissions, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role !== "manager") { res.status(400).json({ error: "Permissions only apply to managers" }); return; }
  res.json({ permissions: user.permissions ?? null });
});

router.patch("/users/:id/permissions", requireAuth, requireRole("owner"), async (req, res) => {
  const userId = parseInt(String(req.params.id), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    res.status(400).json({ error: "permissions must be a plain object" }); return;
  }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role !== "manager") { res.status(400).json({ error: "Permissions only apply to managers" }); return; }
  await db.update(usersTable).set({ permissions }).where(eq(usersTable.id, userId));
  res.json({ success: true, permissions });
});

// Coins
router.get("/coins/balance", requireAuth, async (req: AuthRequest, res) => {
  const { userCoinsTable, appSettingsTable: ast } = await import("@workspace/db");
  const [coins] = await db.select().from(userCoinsTable).where(eq(userCoinsTable.userId, req.userId!)).limit(1);
  const [settings] = await db.select().from(ast).limit(1);
  res.json({ balance: coins?.balance ?? 0, coinValue: settings ? parseFloat(settings.coinValue) : 0.10 });
});

router.get("/coins/transactions", requireAuth, async (req: AuthRequest, res) => {
  const { coinTransactionsTable } = await import("@workspace/db");
  const txns = await db.select().from(coinTransactionsTable).where(eq(coinTransactionsTable.userId, req.userId!)).orderBy(coinTransactionsTable.createdAt);
  res.json(txns.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

router.get("/referral/info", requireAuth, async (req: AuthRequest, res) => {
  const { referralsTable } = await import("@workspace/db");
  const [user] = await db.select({ referralCode: usersTable.referralCode }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, req.userId!));
  const totalCoins = referrals.reduce((s, r) => s + r.coinsAwarded, 0);
  res.json({ referralCode: user?.referralCode ?? "", totalReferrals: referrals.length, coinsEarned: totalCoins });
});

// Spin
router.post("/spin", requireAuth, async (req: AuthRequest, res) => {
  const { spinLogsTable, userCoinsTable, coinTransactionsTable } = await import("@workspace/db");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const todaySpin = await db.select().from(spinLogsTable).where(and(eq(spinLogsTable.userId, req.userId!), gte(spinLogsTable.spunAt, today))).limit(1);
  if (todaySpin.length > 0) { res.status(400).json({ error: "Already spun today" }); return; }

  const prizes = [{ prize: "50 Coins", coins: 50 }, { prize: "10 Coins", coins: 10 }, { prize: "Better luck next time", coins: 0 }, { prize: "100 Coins", coins: 100 }, { prize: "20 Coins", coins: 20 }, { prize: "Better luck next time", coins: 0 }];
  const result = prizes[Math.floor(Math.random() * prizes.length)];

  await db.transaction(async (tx) => {
    await tx.insert(spinLogsTable).values({ userId: req.userId!, prize: result.prize, coinsWon: result.coins });
    if (result.coins > 0) {
      await tx.insert(userCoinsTable).values({ userId: req.userId!, balance: result.coins })
        .onConflictDoUpdate({ target: userCoinsTable.userId, set: { balance: sql`user_coins.balance + ${result.coins}` } });
      await tx.insert(coinTransactionsTable).values({ userId: req.userId!, type: "spin", amount: result.coins, description: "Spin & Win reward" });
    }
  });

  res.json({ prize: result.prize, coinsWon: result.coins, discountCode: null });
});

router.get("/spin/status", requireAuth, async (req: AuthRequest, res) => {
  const { spinLogsTable } = await import("@workspace/db");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const [spin] = await db.select().from(spinLogsTable).where(and(eq(spinLogsTable.userId, req.userId!), gte(spinLogsTable.spunAt, today))).limit(1);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  res.json({ canSpin: !spin, nextSpinAt: spin ? tomorrow.toISOString() : null });
});

export default router;
