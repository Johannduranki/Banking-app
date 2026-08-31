import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  userId: text("user_id").primaryKey(),
  balance: real("balance").notNull().default(32480.5),
  savings: real("savings").notNull().default(14500),
  cardFrozen: integer("card_frozen", { mode: "boolean" }).notNull().default(false),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_transactions_user_created").on(table.userId, table.createdAt)]);
