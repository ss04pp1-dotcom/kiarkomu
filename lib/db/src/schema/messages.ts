import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  recipientId: integer("recipient_id"),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const autoReplyRulesTable = pgTable("auto_reply_rules", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  response: text("response").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Message = typeof messagesTable.$inferSelect;
export type AutoReplyRule = typeof autoReplyRulesTable.$inferSelect;
