import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ledgerEntries = sqliteTable("ledger_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceKey: text("source_key").unique(),
  kind: text("kind").notNull(),
  owner: text("owner").notNull().default("family"),
  entryDate: text("entry_date").notNull(),
  month: text("month"),
  title: text("title").notNull(),
  category: text("category").notNull().default("其他"),
  amountCents: integer("amount_cents").notNull().default(0),
  detail: text("detail").notNull().default(""),
  payer: text("payer").notNull().default("family"),
  giftType: text("gift_type"),
  source: text("source").notNull().default("manual"),
  createdByRole: text("created_by_role").notNull().default("system"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const savingsAccounts = sqliteTable("savings_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull().default("其他"),
  balanceCents: integer("balance_cents").notNull().default(0),
  detail: text("detail").notNull().default(""),
  updatedByRole: text("updated_by_role").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const familyProjects = sqliteTable("family_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  budgetCents: integer("budget_cents").notNull().default(0),
  status: text("status").notNull().default("进行中"),
  detail: text("detail").notNull().default(""),
  updatedByRole: text("updated_by_role").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const projectExpenses = sqliteTable("project_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => familyProjects.id, { onDelete: "cascade" }),
  expenseDate: text("expense_date").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("其他"),
  amountCents: integer("amount_cents").notNull().default(0),
  detail: text("detail").notNull().default(""),
  updatedByRole: text("updated_by_role").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
