import { pgTable, serial, text, numeric, timestamp, index } from "drizzle-orm/pg-core";

export const trackingEventsTable = pgTable(
  "tracking_events",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(),
    productId: text("product_id"),
    productName: text("product_name"),
    value: numeric("value", { precision: 12, scale: 2 }),
    sessionId: text("session_id"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [
    index("tracking_events_type_idx").on(t.eventType),
    index("tracking_events_created_at_idx").on(t.createdAt),
    index("tracking_events_utm_source_idx").on(t.utmSource),
    index("tracking_events_session_id_idx").on(t.sessionId),
  ]
);

export type TrackingEvent = typeof trackingEventsTable.$inferSelect;
export type InsertTrackingEvent = typeof trackingEventsTable.$inferInsert;
