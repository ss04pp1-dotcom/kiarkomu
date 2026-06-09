import { logger } from "./logger.js";

const SANDBOX_BASE = "https://sandbox.carrybee.com";
const PRODUCTION_BASE = "https://developers.carrybee.com";

const SANDBOX_CLIENT_ID = "1a89c1a6-fc68-4395-9c09-628e0d3eaafc";
const SANDBOX_CLIENT_SECRET = "1d7152c9-5b2d-4e4e-9c20-652b93333704";
const SANDBOX_CLIENT_CONTEXT = "DzJwPsx31WaTbS745XZoBjmQLcNqwK";

export interface CarrybeeSettings {
  carrybeeMode?: string | null;
  carrybeeClientId?: string | null;
  carrybeeClientSecret?: string | null;
  carrybeeClientContext?: string | null;
  carrybeeStoreId?: string | null;
}

function getBase(settings: CarrybeeSettings): string {
  return settings.carrybeeMode === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
}

function getHeaders(settings: CarrybeeSettings): Record<string, string> {
  const isProd = settings.carrybeeMode === "production";
  return {
    "Content-Type": "application/json",
    "Client-ID": isProd ? (settings.carrybeeClientId ?? "") : SANDBOX_CLIENT_ID,
    "Client-Secret": isProd ? (settings.carrybeeClientSecret ?? "") : SANDBOX_CLIENT_SECRET,
    "Client-Context": isProd ? (settings.carrybeeClientContext ?? "") : SANDBOX_CLIENT_CONTEXT,
  };
}

export interface CarrybeeOrderPayload {
  storeId: string;
  merchantOrderId: string;
  recipientPhone: string;
  recipientName: string;
  recipientAddress: string;
  cityId: number;
  zoneId: number;
  areaId?: number;
  collectableAmount: number;
  itemWeight?: number;
  productDescription?: string;
}

export interface CarrybeeOrderResult {
  consignmentId: string;
  merchantOrderId?: string;
  collectableAmount: string;
  deliveryFee: string;
}

export async function carrybeeCreateOrder(
  payload: CarrybeeOrderPayload,
  settings: CarrybeeSettings
): Promise<CarrybeeOrderResult | null> {
  try {
    const base = getBase(settings);
    const headers = getHeaders(settings);

    const body: Record<string, any> = {
      store_id: payload.storeId,
      merchant_order_id: payload.merchantOrderId,
      delivery_type: 1,
      product_type: 1,
      recipient_phone: payload.recipientPhone,
      recipient_name: payload.recipientName,
      recipient_address: payload.recipientAddress,
      city_id: payload.cityId,
      zone_id: payload.zoneId,
      collectable_amount: Math.round(payload.collectableAmount),
      item_weight: payload.itemWeight ?? 500,
    };
    if (payload.areaId) body.area_id = payload.areaId;
    if (payload.productDescription) body.product_description = payload.productDescription;

    const res = await fetch(`${base}/api/v2/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, body: text }, "Carrybee create order failed");
      let apiMessage = `HTTP ${res.status}`;
      try { const j = JSON.parse(text); apiMessage = j?.message ?? j?.error ?? apiMessage; } catch { }
      throw new Error(`Carrybee API error: ${apiMessage}`);
    }

    const data = await res.json() as any;
    logger.info({ responseKeys: Object.keys(data ?? {}), dataKeys: Object.keys(data?.data ?? {}) }, "Carrybee create order raw response");

    if (data.error) {
      logger.error({ data }, "Carrybee create order returned error");
      throw new Error(`Carrybee API error: ${data.message ?? data.error ?? "Unknown error"}`);
    }

    // API v2 returns data.data.consignment_id directly (not nested under data.data.order)
    // Support both shapes in case the sandbox differs from production
    const responseData = data.data?.order ?? data.data ?? {};
    const consignmentId = responseData.consignment_id ?? null;
    logger.info({ consignmentId, responseKeys: Object.keys(data?.data ?? {}) }, "Carrybee consignment created");

    if (!consignmentId) {
      logger.error({ data }, "Carrybee create order: consignment_id missing in response");
      throw new Error("Carrybee API error: consignment_id missing in response");
    }

    return {
      consignmentId: String(consignmentId),
      merchantOrderId: responseData.merchant_order_id ?? null,
      collectableAmount: responseData.collectable_amount ?? null,
      deliveryFee: responseData.delivery_fee ?? null,
    };
  } catch (err) {
    logger.error({ err }, "Carrybee createOrder threw unexpected error");
    throw err;
  }
}

export async function carrybeeGetOrderDetails(
  consignmentId: string,
  settings: CarrybeeSettings
): Promise<{ transferStatus: string } | null> {
  try {
    const base = getBase(settings);
    const headers = getHeaders(settings);
    const res = await fetch(`${base}/api/v2/orders/${consignmentId}/details`, { headers });
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data.error) return null;
    return { transferStatus: data.data?.transfer_status ?? "Unknown" };
  } catch (err) {
    logger.error({ err }, "Carrybee getOrderDetails error");
    return null;
  }
}

export async function carrybeeGetAddressDetails(
  query: string,
  settings: CarrybeeSettings
): Promise<{ cityId: number; zoneId: number } | null> {
  try {
    const base = getBase(settings);
    const headers = getHeaders(settings);
    const res = await fetch(`${base}/api/v2/address-details`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data.error) return null;
    return { cityId: data.data?.city_id, zoneId: data.data?.zone_id };
  } catch {
    return null;
  }
}

export async function carrybeeGetStores(
  settings: CarrybeeSettings
): Promise<Array<{ id: string; name: string; is_active: boolean }> | null> {
  try {
    const base = getBase(settings);
    const headers = getHeaders(settings);
    const { "Content-Type": _ct, ...headersWithoutContentType } = headers;
    const res = await fetch(`${base}/api/v2/stores`, { headers: headersWithoutContentType });
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data.error) return null;
    return data.data?.stores ?? [];
  } catch (err) {
    logger.error({ err }, "Carrybee getStores error");
    return null;
  }
}
