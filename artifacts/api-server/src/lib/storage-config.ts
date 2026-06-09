import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { safeDecrypt, isEncrypted } from "./crypto.js";

export interface StorageConfig {
  provider: "supabase" | "aws_s3" | "local";
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseBucket?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsRegion?: string;
  awsBucket?: string;
}

let _cache: { config: StorageConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

function dec(v?: string): string | undefined {
  if (!v) return undefined;
  return isEncrypted(v) ? (safeDecrypt(v) ?? v) : v;
}

export function invalidateStorageCache(): void {
  _cache = null;
}

export async function getStorageConfig(): Promise<StorageConfig> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.config;

  try {
    const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.id, "mobile")).limit(1);
    const raw = (row?.config ?? {}) as any;

    const config: StorageConfig = {
      provider: (raw.storageProvider as StorageConfig["provider"]) ?? "local",
      supabaseUrl: raw.supabaseUrl as string | undefined,
      supabaseServiceKey: dec(raw.supabaseServiceKey as string | undefined),
      supabaseBucket: (raw.supabaseBucket as string | undefined) ?? "images",
      awsAccessKey: dec(raw.awsAccessKey as string | undefined),
      awsSecretKey: dec(raw.awsSecretKey as string | undefined),
      awsRegion: raw.awsRegion as string | undefined,
      awsBucket: raw.awsBucket as string | undefined,
    };

    if (
      config.provider === "local" &&
      process.env["SUPABASE_URL"] &&
      process.env["SUPABASE_SERVICE_KEY"]
    ) {
      config.provider = "supabase";
      config.supabaseUrl = config.supabaseUrl ?? process.env["SUPABASE_URL"];
      config.supabaseServiceKey = config.supabaseServiceKey ?? process.env["SUPABASE_SERVICE_KEY"];
      config.supabaseBucket = config.supabaseBucket ?? (process.env["SUPABASE_STORAGE_BUCKET"] ?? "images");
    }

    _cache = { config, expiresAt: Date.now() + CACHE_TTL_MS };
    return config;
  } catch {
    return {
      provider:
        process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_KEY"]
          ? "supabase"
          : "local",
      supabaseUrl: process.env["SUPABASE_URL"],
      supabaseServiceKey: process.env["SUPABASE_SERVICE_KEY"],
      supabaseBucket: process.env["SUPABASE_STORAGE_BUCKET"] ?? "images",
    };
  }
}
