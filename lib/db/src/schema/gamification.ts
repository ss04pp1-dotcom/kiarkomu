import { pgTable, serial, integer, text, timestamp, boolean, numeric, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const userCoinsTable = pgTable("user_coins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const coinTransactionsTable = pgTable("coin_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("coin_transactions_user_id_idx").on(t.userId),
]);

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referredId: integer("referred_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  coinsAwarded: integer("coins_awarded").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const spinLogsTable = pgTable("spin_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  prize: text("prize").notNull(),
  coinsWon: integer("coins_won").notNull().default(0),
  discountCode: text("discount_code"),
  spunAt: timestamp("spun_at").notNull().defaultNow(),
}, (t) => [
  index("spin_logs_user_id_idx").on(t.userId),
]);

export type UserCoins = typeof userCoinsTable.$inferSelect;
