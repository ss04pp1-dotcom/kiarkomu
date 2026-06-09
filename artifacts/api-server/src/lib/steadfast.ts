import { logger } from "./logger.js";

const BASE_URL = "https://portal.packzy.com/api/v1";

export interface SteadfastOrderPayload {
  invoice: string | number;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  delivery_type?: number;
  note?: string;
}

export interface SteadfastConsignment {
  consignment_id: number;
  tracking_code: string;
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  status: string;
}

export interface SteadfastOrderResult {
  status: number;
  message: string;
  consignment: SteadfastConsignment;
}

export interface SteadfastStatusResult {
  status: number;
  delivery_status: string;
  consignment?: SteadfastConsignment;
}

function getHeaders(): Record<string, string> {
  const apiKey = process.env["STEADFAST_API_KEY"];
  const secretKey = process.env["STEADFAST_SECRET_KEY"];
  if (!apiKey || !secretKey) {
    throw new Error("STEADFAST_API_KEY and STEADFAST_SECRET_KEY environment variables must be set");
  }
  return {
    "Content-Type": "application/json",
    "Api-Key": apiKey,
    "Secret-Key": secretKey,
  };
}

export async function createCourierOrder(
  payload: SteadfastOrderPayload
): Promise<SteadfastOrderResult | null> {
  try {
    const body = {
      invoice: String(payload.invoice),
      recipient_name: payload.recipient_name,
      recipient_phone: payload.recipient_phone,
      recipient_address: payload.recipient_address,
      cod_amount: payload.cod_amount,
      delivery_type: payload.delivery_type ?? 0,
      note: payload.note ?? "",
    };

    const response = await fetch(`${BASE_URL}/create_order`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error(
        { status: response.status, body: text },
        "Steadfast create_order returned non-OK response"
      );
      let apiMessage = `HTTP ${response.status}`;
      try { const j = JSON.parse(text); apiMessage = j?.message ?? j?.error ?? apiMessage; } catch { }
      throw new Error(`Steadfast API error: ${apiMessage}`);
    }

    const data = (await response.json()) as SteadfastOrderResult;

    if (data?.status !== 200) {
      logger.error({ data }, "Steadfast create_order returned non-200 status");
      throw new Error(`Steadfast API error: ${data?.message ?? "Unknown error"}`);
    }

    logger.info(
      { orderId: payload.invoice, consignmentId: data.consignment?.consignment_id },
      "Steadfast consignment created"
    );
    return data;
  } catch (err) {
    logger.error({ err }, "Steadfast createCourierOrder threw an unexpected error");
    throw err;
  }
}

export async function checkDeliveryStatus(
  invoiceId: string | number
): Promise<SteadfastStatusResult | null> {
  try {
    const response = await fetch(`${BASE_URL}/status_by_invoice/${invoiceId}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error(
        { status: response.status, body: text, invoiceId },
        "Steadfast status_by_invoice returned non-OK response"
      );
      return null;
    }

    return (await response.json()) as SteadfastStatusResult;
  } catch (err) {
    logger.error({ err, invoiceId }, "Steadfast checkDeliveryStatus threw an unexpected error");
    return null;
  }
}
