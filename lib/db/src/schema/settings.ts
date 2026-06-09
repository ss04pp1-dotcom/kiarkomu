import { pgTable, serial, text, boolean, numeric, integer } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  siteName: text("site_name").notNull().default("Shohure"),
  logoUrl: text("logo_url"),
  currency: text("currency").notNull().default("BDT"),
  defaultLanguage: text("default_language").notNull().default("en"),
  enableFreeDelivery: boolean("enable_free_delivery").notNull().default(true),
  freeDeliveryThreshold: numeric("free_delivery_threshold", { precision: 10, scale: 2 }).notNull().default("500"),
  coinValue: numeric("coin_value", { precision: 6, scale: 2 }).notNull().default("0.10"),
  sslcommerzStoreId: text("sslcommerz_store_id"),
  sslcommerzStorePassword: text("sslcommerz_store_password"),
  sslcommerzSandbox: boolean("sslcommerz_sandbox").notNull().default(true),
  promoCardsJson: text("promo_cards_json"),
  primaryColor: text("primary_color").notNull().default("#E91E63"),
  smtpEmail: text("smtp_email"),
  smtpPassword: text("smtp_password"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  googleClientId: text("google_client_id"),
  googleClientSecret: text("google_client_secret"),
  googleAndroidClientId: text("google_android_client_id"),
  googleIosClientId: text("google_ios_client_id"),
  whatsappNumber: text("whatsapp_number"),
  // MFS payment numbers
  bkashNumber: text("bkash_number"),
  nagadNumber: text("nagad_number"),
  rocketNumber: text("rocket_number"),
  // MFS enabled flags
  bkashEnabled: boolean("bkash_enabled").notNull().default(true),
  nagadEnabled: boolean("nagad_enabled").notNull().default(true),
  rocketEnabled: boolean("rocket_enabled").notNull().default(true),
  codEnabled: boolean("cod_enabled").notNull().default(true),
  cardEnabled: boolean("card_enabled").notNull().default(true),
  // MFS logo URLs
  bkashLogoUrl: text("bkash_logo_url"),
  nagadLogoUrl: text("nagad_logo_url"),
  rocketLogoUrl: text("rocket_logo_url"),
  // MFS number labels
  bkashNumberLabel: text("bkash_number_label").notNull().default("bKash Number"),
  nagadNumberLabel: text("nagad_number_label").notNull().default("Nagad Number"),
  rocketNumberLabel: text("rocket_number_label").notNull().default("Rocket Number"),
  // Custom transaction ID label per method
  bkashTxnLabel: text("bkash_txn_label").notNull().default("Transaction ID (TrxID)"),
  nagadTxnLabel: text("nagad_txn_label").notNull().default("Transaction ID (TrxID)"),
  rocketTxnLabel: text("rocket_txn_label").notNull().default("Transaction ID (TrxID)"),
  // Courier services
  steadfastEnabled: boolean("steadfast_enabled").notNull().default(false),
  carrybeeEnabled: boolean("carrybee_enabled").notNull().default(false),
  courierAutoSubmit: boolean("courier_auto_submit").notNull().default(false),
  activeCourier: text("active_courier"),
  carrybeeMode: text("carrybee_mode").notNull().default("sandbox"),
  carrybeeClientId: text("carrybee_client_id"),
  carrybeeClientSecret: text("carrybee_client_secret"),
  carrybeeClientContext: text("carrybee_client_context"),
  carrybeeStoreId: text("carrybee_store_id"),
  // Pay Delivery Charge (partial payment) option
  payDeliveryChargeEnabled: boolean("pay_delivery_charge_enabled").notNull().default(false),
  // Cleanup retention
  notificationRetentionDays: integer("notification_retention_days").notNull().default(7),
  // Legal URLs
  privacyPolicyUrl: text("privacy_policy_url"),
  termsOfServiceUrl: text("terms_of_service_url"),
  // Welcome coupon shown in new-user notifications
  welcomeCouponCode: text("welcome_coupon_code"),
  // Web storefront announcement ticker
  webAnnouncementText: text("web_announcement_text"),
  webAnnouncementActive: boolean("web_announcement_active").notNull().default(true),
  // Tracking & Retargeting
  facebookPixelId: text("facebook_pixel_id"),
  googleTagId: text("google_tag_id"),
  // GA4 Measurement Protocol (server-side)
  gaApiSecret: text("ga_api_secret"),
  // Meta Conversions API (server-side)
  metaAccessToken: text("meta_access_token"),
  metaTestEventCode: text("meta_test_event_code"),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
