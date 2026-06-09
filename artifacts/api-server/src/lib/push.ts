import { logger } from "./logger.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const CHUNK_SIZE = 100;
const RECEIPT_POLL_DELAY_MS = 30_000;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

function isValidToken(t: unknown): t is string {
  return (
    typeof t === "string" &&
    (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))
  );
}

async function clearInvalidTokens(tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  try {
    await db
      .update(usersTable)
      .set({ pushToken: null })
      .where(inArray(usersTable.pushToken, tokens));
    logger.info({ count: tokens.length }, "Cleared invalid/unregistered push tokens from DB");
  } catch (err) {
    logger.error({ err }, "Failed to clear invalid push tokens");
  }
}

async function pollReceipts(receiptMap: Map<string, string>): Promise<void> {
  if (!receiptMap.size) return;
  try {
    const ids = Array.from(receiptMap.keys());
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    });
    const result = await response.json() as { data: Record<string, ExpoPushReceipt> };
    const invalidTokens: string[] = [];

    for (const [receiptId, receipt] of Object.entries(result.data)) {
      if (receipt.status === "error") {
        logger.warn(
          { receiptId, message: receipt.message, error: receipt.details?.error },
          "Push receipt delivery error"
        );
        if (receipt.details?.error === "DeviceNotRegistered") {
          const token = receiptMap.get(receiptId);
          if (token) invalidTokens.push(token);
        }
      }
    }

    if (invalidTokens.length) await clearInvalidTokens(invalidTokens);
  } catch (err) {
    logger.error({ err }, "Failed to poll push receipts");
  }
}

async function sendChunk(
  messages: ExpoPushMessage[],
  tokenList: string[]
): Promise<{ receiptMap: Map<string, string>; invalidTokens: string[] }> {
  const receiptMap = new Map<string, string>();
  const invalidTokens: string[] = [];

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json() as { data: ExpoPushTicket[] };
    const tickets = Array.isArray(result.data) ? result.data : [];

    tickets.forEach((ticket, i) => {
      const token = tokenList[i];
      if (!token) return;
      if (ticket.status === "error") {
        logger.warn({ ticket, token }, "Push ticket error on send");
        if (ticket.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(token);
        }
      } else if (ticket.id) {
        receiptMap.set(ticket.id, token);
      }
    });
  } catch (err) {
    logger.error({ err }, "Failed to send push notification chunk");
  }

  return { receiptMap, invalidTokens };
}

export async function sendPushNotification(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!isValidToken(token)) {
    if (token) logger.warn({ token }, "Invalid Expo push token format, skipping");
    return;
  }

  const message: ExpoPushMessage = {
    to: token,
    sound: "default",
    title,
    body,
    data: data ?? {},
    priority: "high",
  };

  const { receiptMap, invalidTokens } = await sendChunk([message], [token]);

  if (invalidTokens.length) await clearInvalidTokens(invalidTokens);
  if (receiptMap.size) {
    setTimeout(() => pollReceipts(receiptMap).catch(() => {}), RECEIPT_POLL_DELAY_MS);
  }
}

export async function sendPushNotifications(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const validTokens = tokens.filter(isValidToken);
  if (!validTokens.length) return;

  const allReceiptMap = new Map<string, string>();
  const allInvalidTokens: string[] = [];

  for (let i = 0; i < validTokens.length; i += CHUNK_SIZE) {
    const chunk = validTokens.slice(i, i + CHUNK_SIZE);
    const messages: ExpoPushMessage[] = chunk.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data: data ?? {},
      priority: "high",
    }));

    const { receiptMap, invalidTokens } = await sendChunk(messages, chunk);
    for (const [k, v] of receiptMap) allReceiptMap.set(k, v);
    allInvalidTokens.push(...invalidTokens);
  }

  if (allInvalidTokens.length) await clearInvalidTokens(allInvalidTokens);

  if (allReceiptMap.size) {
    logger.info({ count: validTokens.length, title }, "Push notifications sent — scheduling receipt poll");
    setTimeout(() => pollReceipts(allReceiptMap).catch(() => {}), RECEIPT_POLL_DELAY_MS);
  }
}
