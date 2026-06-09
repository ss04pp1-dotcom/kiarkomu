import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const emailVerificationsTable = pgTable("email_verifications", {
  email: text("email").primaryKey(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  firstAttemptAt: timestamp("first_attempt_at"),
});

export type EmailVerification = typeof emailVerificationsTable.$inferSelect;
export type InsertEmailVerification = typeof emailVerificationsTable.$inferInsert;
