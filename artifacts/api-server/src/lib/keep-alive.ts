import { logger } from "./logger.js";

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let handle: ReturnType<typeof setInterval> | null = null;

async function ping(url: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    logger.info({ status: res.status }, "Keep-alive ping succeeded");
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Keep-alive ping failed");
  } finally {
    clearTimeout(timeout);
  }
}

export function setupKeepAlive(): void {
  const replitDomain = process.env["REPLIT_DEV_DOMAIN"];
  const base =
    process.env["RENDER_EXTERNAL_URL"] ??
    (replitDomain ? `https://${replitDomain}` : undefined);

  if (!base) {
    logger.info("Keep-alive disabled (no external URL found)");
    return;
  }

  const url = `${base}/api/healthz`;
  logger.info({ url, intervalMinutes: 10 }, "Keep-alive enabled");

  if (handle) return;
  handle = setInterval(() => ping(url), PING_INTERVAL_MS);
}

export function stopKeepAlive(): void {
  if (handle) {
    clearInterval(handle);
    handle = null;
  }
}
