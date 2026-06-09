import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";

export const shippingZonesTable = pgTable("shipping_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  districts: text("districts").array().notNull().default([]),
  fee: numeric("fee", { precision: 10, scale: 2 }).notNull(),
  estimatedDays: integer("estimated_days").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storesTable = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  long: numeric("long", { precision: 10, scale: 7 }).notNull(),
  openingHours: text("opening_hours").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ShippingZone = typeof shippingZonesTable.$inferSelect;
export type Store = typeof storesTable.$inferSelect;
