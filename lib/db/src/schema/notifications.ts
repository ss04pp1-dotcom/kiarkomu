import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("general"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("notifications_user_id_idx").on(t.userId),
]);

export type Notification = typeof notificationsTable.$inferSelect;

export const scheduledNotificationsTable = pgTable("scheduled_notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("general"),
  scheduleType: text("schedule_type").notNull().default("daily"),
  scheduleTime: text("schedule_time").notNull().default("09:00"),
  scheduleDayOfWeek: integer("schedule_day_of_week"),
  scheduleDayOfMonth: integer("schedule_day_of_month"),
  scheduledAt: timestamp("scheduled_at"),
  target: text("target").notNull().default("all"),
  targetUserIds: text("target_user_ids").notNull().default("[]"),
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ScheduledNotification = typeof scheduledNotificationsTable.$inferSelect;
