import { Router } from "express";
import { db } from "@workspace/db";
import { addressesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/addresses", requireAuth, async (req: AuthRequest, res) => {
  const list = await db.select().from(addressesTable).where(eq(addressesTable.userId, req.userId!));
  res.json(list);
});

router.post("/addresses", requireAuth, async (req: AuthRequest, res) => {
  const { label, fullName, phone, addressLine, district, area, postalCode, isDefault } = req.body;
  if (!fullName?.trim() || !phone?.trim() || !addressLine?.trim() || !district?.trim()) {
    res.status(400).json({ error: "fullName, phone, addressLine, and district are required" });
    return;
  }
  if (isDefault) {
    await db.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, req.userId!));
  }
  const [addr] = await db.insert(addressesTable).values({ userId: req.userId!, label, fullName, phone, addressLine, district, area, postalCode, isDefault: isDefault ?? false }).returning();
  res.status(201).json(addr);
});

router.patch("/addresses/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string, 10);
  const body = req.body;

  // Validate that required fields are not set to empty strings
  const requiredFields: Array<{ key: string; label: string }> = [
    { key: "fullName", label: "Full name" },
    { key: "phone", label: "Phone" },
    { key: "addressLine", label: "Address line" },
    { key: "district", label: "District" },
  ];
  for (const { key, label } of requiredFields) {
    if (body[key] !== undefined && !String(body[key]).trim()) {
      res.status(400).json({ error: `${label} cannot be empty` });
      return;
    }
  }

  if (body.isDefault) {
    await db.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, req.userId!));
  }
  // Sanitize update fields to prevent mass assignment
  const update: any = {};
  if (body.label !== undefined) update.label = body.label;
  if (body.fullName !== undefined) update.fullName = String(body.fullName).trim();
  if (body.phone !== undefined) update.phone = String(body.phone).trim();
  if (body.addressLine !== undefined) update.addressLine = String(body.addressLine).trim();
  if (body.district !== undefined) update.district = String(body.district).trim();
  if (body.area !== undefined) update.area = body.area;
  if (body.postalCode !== undefined) update.postalCode = body.postalCode;
  if (body.isDefault !== undefined) update.isDefault = body.isDefault;
  const [addr] = await db.update(addressesTable).set(update).where(and(eq(addressesTable.id, id), eq(addressesTable.userId, req.userId!))).returning();
  if (!addr) { res.status(404).json({ error: "Address not found" }); return; }
  res.json(addr);
});

router.delete("/addresses/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db
    .select({ id: addressesTable.id, userId: addressesTable.userId })
    .from(addressesTable)
    .where(eq(addressesTable.id, id))
    .limit(1);

  if (!existing) { res.status(404).json({ error: "Address not found" }); return; }
  if (existing.userId !== req.userId!) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(addressesTable).where(eq(addressesTable.id, id));
  res.json({ success: true });
});

export default router;
