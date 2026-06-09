import { Router } from "express";
import { db } from "@workspace/db";
import { appConfigTable, appSettingsTable, type AppConfig } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt, safeDecrypt, isEncrypted } from "../lib/crypto.js";
import { invalidateStorageCache } from "../lib/storage-config.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import jwt from "jsonwebtoken";

const router = Router();

const SECRET_FIELDS: (keyof AppConfig)[] = [
  "googleClientSecret",
  "appPassword",
  "supabaseServiceKey",
  "awsAccessKey",
  "awsSecretKey",
];

function encryptSecrets(config: AppConfig): AppConfig {
  const result = { ...config };
  for (const field of SECRET_FIELDS) {
    const val = result[field] as string | undefined;
    if (val && !isEncrypted(val)) {
      (result as any)[field] = encrypt(val);
    }
  }
  return result;
}

function decryptSecrets(config: AppConfig): AppConfig {
  const result = { ...config };
  for (const field of SECRET_FIELDS) {
    const val = result[field] as string | undefined;
    if (val && isEncrypted(val)) {
      (result as any)[field] = safeDecrypt(val) ?? val;
    }
  }
  return result;
}

router.post("/admin/login", (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env["ADMIN_EMAIL"];
  const adminPassword = process.env["ADMIN_PASSWORD"];
  const secret = process.env["ADMIN_JWT_SECRET"];

  if (!adminEmail || !adminPassword || !secret) {
    res.status(500).json({ error: "Server misconfigured: admin credentials not set" });
    return;
  }

  if (email !== adminEmail || password !== adminPassword) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ email }, secret, { expiresIn: "7d" });
  res.json({ token });
});

router.get("/config/mobile", async (_req, res) => {
  try {
    const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.id, "mobile")).limit(1);

    // Fetch and merge ALL public settings, including payment configurations, numbers, and logos
    const [settings] = await db.select({
      siteName: appSettingsTable.siteName,
      whatsappNumber: appSettingsTable.whatsappNumber,
      primaryColor: appSettingsTable.primaryColor,
      googleClientId: appSettingsTable.googleClientId,
      enableFreeDelivery: appSettingsTable.enableFreeDelivery,
      freeDeliveryThreshold: appSettingsTable.freeDeliveryThreshold,
      promoCardsJson: appSettingsTable.promoCardsJson,
      // Payment switches
      codEnabled: appSettingsTable.codEnabled,
      bkashEnabled: appSettingsTable.bkashEnabled,
      nagadEnabled: appSettingsTable.nagadEnabled,
      rocketEnabled: appSettingsTable.rocketEnabled,
      cardEnabled: appSettingsTable.cardEnabled,
      payDeliveryChargeEnabled: appSettingsTable.payDeliveryChargeEnabled,
      privacyPolicyUrl: appSettingsTable.privacyPolicyUrl,
      termsOfServiceUrl: appSettingsTable.termsOfServiceUrl,
      // Payment details
      bkashNumber: appSettingsTable.bkashNumber,
      nagadNumber: appSettingsTable.nagadNumber,
      rocketNumber: appSettingsTable.rocketNumber,
      bkashLogoUrl: appSettingsTable.bkashLogoUrl,
      nagadLogoUrl: appSettingsTable.nagadLogoUrl,
      rocketLogoUrl: appSettingsTable.rocketLogoUrl,
      // Form labels
      bkashNumberLabel: appSettingsTable.bkashNumberLabel,
      nagadNumberLabel: appSettingsTable.nagadNumberLabel,
      rocketNumberLabel: appSettingsTable.rocketNumberLabel,
      bkashTxnLabel: appSettingsTable.bkashTxnLabel,
      nagadTxnLabel: appSettingsTable.nagadTxnLabel,
      rocketTxnLabel: appSettingsTable.rocketTxnLabel,
      // Web announcement ticker
      webAnnouncementText: appSettingsTable.webAnnouncementText,
      webAnnouncementActive: appSettingsTable.webAnnouncementActive,
      // Tracking
      facebookPixelId: appSettingsTable.facebookPixelId,
      googleTagId: appSettingsTable.googleTagId,
    }).from(appSettingsTable).limit(1);

    const publicSettings = settings ? {
      siteName: settings.siteName,
      whatsappNumber: settings.whatsappNumber ?? null,
      primaryColor: settings.primaryColor ?? null,
      announcementText: null,
      googleClientId: settings.googleClientId ?? null,
      googleWebClientId: settings.googleClientId ?? null,
      enableFreeDelivery: settings.enableFreeDelivery,
      freeDeliveryThreshold: parseFloat(settings.freeDeliveryThreshold || "0"),
      promoCardsJson: settings.promoCardsJson ?? null,
      // Payments
      codEnabled: settings.codEnabled ?? true,
      bkashEnabled: settings.bkashEnabled ?? true,
      nagadEnabled: settings.nagadEnabled ?? true,
      rocketEnabled: settings.rocketEnabled ?? true,
      cardEnabled: settings.cardEnabled ?? true,
      payDeliveryChargeEnabled: settings.payDeliveryChargeEnabled ?? false,
      privacyPolicyUrl: settings.privacyPolicyUrl ?? null,
      termsOfServiceUrl: settings.termsOfServiceUrl ?? null,
      // Credentials
      bkashNumber: settings.bkashNumber ?? null,
      nagadNumber: settings.nagadNumber ?? null,
      rocketNumber: settings.rocketNumber ?? null,
      bkashLogoUrl: settings.bkashLogoUrl ?? null,
      nagadLogoUrl: settings.nagadLogoUrl ?? null,
      rocketLogoUrl: settings.rocketLogoUrl ?? null,
      // Labels
      bkashNumberLabel: settings.bkashNumberLabel || "PERSONAL NUMBER",
      nagadNumberLabel: settings.nagadNumberLabel || "PERSONAL NUMBER",
      rocketNumberLabel: settings.rocketNumberLabel || "PERSONAL NUMBER",
      bkashTxnLabel: settings.bkashTxnLabel || "Transaction ID (TrxID)",
      nagadTxnLabel: settings.nagadTxnLabel || "Transaction ID (TrxID)",
      rocketTxnLabel: settings.rocketTxnLabel || "Transaction ID (TrxID)",
      // Web announcement ticker
      webAnnouncementText: settings.webAnnouncementText ?? null,
      webAnnouncementActive: settings.webAnnouncementActive ?? true,
      // Tracking
      facebookPixelId: settings.facebookPixelId ?? null,
      googleTagId: settings.googleTagId ?? null,
    } : {};

    if (!row) { res.json(publicSettings); return; }

    const config = row.config as AppConfig;
    const decrypted = decryptSecrets(config);
    const {
      googleClientSecret: _gs,
      appPassword: _ap,
      supabaseServiceKey: _sk,
      awsAccessKey: _ak,
      awsSecretKey: _as,
      ...safeConfig
    } = decrypted;

    res.json({ ...safeConfig, ...publicSettings });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch config" });
  }
});

router.get("/config/admin", adminAuth, async (_req, res) => {
  try {
    const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.id, "mobile")).limit(1);
    if (!row) { res.json({}); return; }
    res.json(decryptSecrets(row.config as AppConfig));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch config" });
  }
});

const ALLOWED_CONFIG_KEYS: Set<keyof AppConfig> = new Set([
  "apiBaseUrl", "googleWebClientId", "googleAndroidClientId", "googleIosClientId",
  "googleClientSecret", "appEmail", "appPassword", "featureFlags",
  "storageProvider", "supabaseUrl", "supabaseServiceKey", "supabaseBucket",
  "awsAccessKey", "awsSecretKey", "awsRegion", "awsBucket",
]);

async function patchConfig(body: Partial<AppConfig>): Promise<void> {
  const sanitized = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED_CONFIG_KEYS.has(k as keyof AppConfig))
  ) as Partial<AppConfig>;

  const [existing] = await db.select().from(appConfigTable).where(eq(appConfigTable.id, "mobile")).limit(1);
  const existingConfig = ((existing?.config ?? {}) as AppConfig);
  const merged: AppConfig = { ...existingConfig, ...sanitized };

  for (const field of SECRET_FIELDS) {
    if (!(body as any)[field]) {
      (merged as any)[field] = (existingConfig as any)[field];
    }
  }

  const encrypted = encryptSecrets(merged);
  await db.insert(appConfigTable)
    .values({ id: "mobile", config: encrypted })
    .onConflictDoUpdate({ target: appConfigTable.id, set: { config: encrypted } });

  invalidateStorageCache();
}

router.patch("/config/mobile", adminAuth, async (req, res) => {
  try {
    await patchConfig(req.body as Partial<AppConfig>);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to save config" });
  }
});

router.put("/config/mobile", adminAuth, async (req, res) => {
  try {
    await patchConfig(req.body as Partial<AppConfig>);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to save config" });
  }
});

export default router;