import { Router } from "express";
import { db } from "@workspace/db";
import { shippingZonesTable, storesTable, appSettingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";

const router = Router();

router.post("/shipping/calculate", async (req, res) => {
  const { district, area, deliveryMethod, orderAmount } = req.body;
  if (deliveryMethod === "store_pickup") { res.json({ fee: 0, estimatedDays: 0, isFree: true, zoneName: "Store Pickup" }); return; }

  const [settings] = await db.select().from(appSettingsTable).limit(1);
  const threshold = settings ? parseFloat(settings.freeDeliveryThreshold) : 500;
  const enableFreeDelivery = settings ? settings.enableFreeDelivery : true;

  if (enableFreeDelivery && orderAmount >= threshold) { res.json({ fee: 0, estimatedDays: 3, isFree: true, zoneName: "Free Delivery" }); return; }

  const zones = await db.select().from(shippingZonesTable);
  const zone = district
    ? zones.find(
        z =>
          z.name.toLowerCase() === district.toLowerCase() ||
          (z.districts as string[]).some(d => d.toLowerCase() === district.toLowerCase())
      )
    : null;
  if (zone) { res.json({ fee: parseFloat(zone.fee), estimatedDays: zone.estimatedDays, isFree: false, zoneName: zone.name }); return; }
  res.json({ fee: 60, estimatedDays: 5, isFree: false, zoneName: "Standard" });
});

router.get("/shipping/zones", async (_req, res) => {
  const zones = await db.select().from(shippingZonesTable);
  res.json(zones.map(z => ({ ...z, fee: parseFloat(z.fee), districts: z.districts as string[] })));
});

router.post("/shipping/zones", requireAuth, requireRole("owner"), async (req, res) => {
  const fee = (req.body.rate ?? req.body.fee ?? 0).toString();
  const [z] = await db.insert(shippingZonesTable).values({ name: req.body.name, districts: req.body.districts ?? [], fee, estimatedDays: req.body.estimatedDays ?? 3 }).returning();
  res.status(201).json({ ...z, fee: parseFloat(z.fee), rate: parseFloat(z.fee), districts: z.districts as string[] });
});

router.patch("/shipping/zones/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const body = req.body;
  const update: any = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.districts !== undefined) update.districts = body.districts;
  if (body.fee !== undefined) update.fee = body.fee.toString();
  if (body.rate !== undefined) update.fee = body.rate.toString();
  if (body.estimatedDays !== undefined) update.estimatedDays = body.estimatedDays;
  const [z] = await db.update(shippingZonesTable).set(update).where(eq(shippingZonesTable.id, parseInt(req.params.id as string))).returning();
  res.json({ ...z, fee: parseFloat(z.fee), districts: z.districts as string[] });
});

router.delete("/shipping/zones/:id", requireAuth, requireRole("owner"), async (req, res) => {
  await db.delete(shippingZonesTable).where(eq(shippingZonesTable.id, parseInt(req.params.id as string)));
  res.json({ success: true });
});

// Stores
router.get("/stores", async (_req, res) => {
  const stores = await db.select().from(storesTable);
  res.json(stores.map(s => ({ ...s, lat: parseFloat(s.lat), long: parseFloat(s.long) })));
});

router.post("/stores", requireAuth, requireRole("owner"), async (req, res) => {
  const { name, address, city, lat, long, openingHours, phone } = req.body;
  const fullAddress = city ? `${address}, ${city}` : address;
  const [s] = await db.insert(storesTable).values({ name, address: fullAddress, lat: (lat ?? "0").toString(), long: (long ?? "0").toString(), openingHours, phone }).returning();
  res.status(201).json({ ...s, lat: parseFloat(s.lat), long: parseFloat(s.long) });
});

router.patch("/stores/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const body = req.body;
  const update: any = { ...body };
  if (body.lat !== undefined) update.lat = body.lat.toString();
  if (body.long !== undefined) update.long = body.long.toString();
  const [s] = await db.update(storesTable).set(update).where(eq(storesTable.id, parseInt(req.params.id as string))).returning();
  res.json({ ...s, lat: parseFloat(s.lat), long: parseFloat(s.long) });
});

router.delete("/stores/:id", requireAuth, requireRole("owner"), async (req, res) => {
  await db.delete(storesTable).where(eq(storesTable.id, parseInt(req.params.id as string)));
  res.json({ success: true });
});

export default router;
