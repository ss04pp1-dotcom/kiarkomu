import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

export interface AppConfig {
  apiBaseUrl: string;
  googleWebClientId: string;
  googleAndroidClientId?: string;
  googleIosClientId?: string;
  googleClientSecret: string;
  appEmail: string;
  appPassword: string;
  featureFlags: Record<string, boolean>;
  storageProvider?: "supabase" | "aws_s3" | "local";
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseBucket?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsRegion?: string;
  awsBucket?: string;
}

export const appConfigTable = pgTable("app_config", {
  id: text("id").primaryKey().default("mobile"),
  config: jsonb("config").notNull().$type<AppConfig>(),
});

export type AppConfigRow = typeof appConfigTable.$inferSelect;
