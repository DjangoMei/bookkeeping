import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { seedFeishuEntries } from "./feishu-seed";
import * as schema from "./schema";

let ledgerSchemaPromise: Promise<void> | null = null;
let familyFinanceSchemaPromise: Promise<void> | null = null;

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

async function initializeLedgerSchema() {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      source_key TEXT UNIQUE,
      kind TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT 'family',
      entry_date TEXT NOT NULL,
      month TEXT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '',
      payer TEXT NOT NULL DEFAULT 'family',
      gift_type TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_by_role TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const columns = await env.DB.prepare("PRAGMA table_info(ledger_entries)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "payer")) {
    await env.DB.prepare("ALTER TABLE ledger_entries ADD COLUMN payer TEXT NOT NULL DEFAULT 'family'").run();
    await env.DB.prepare("UPDATE ledger_entries SET payer = 'mother' WHERE kind = 'child_expense' AND detail LIKE '%妈妈%'").run();
  }

  await seedFeishuEntries(env.DB);
}

export function ensureLedgerSchema() {
  ledgerSchemaPromise ??= initializeLedgerSchema().catch((error) => {
    ledgerSchemaPromise = null;
    throw error;
  });
  return ledgerSchemaPromise;
}

async function initializeFamilyFinanceSchema() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS savings_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      balance_cents INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '',
      updated_by_role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS family_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      budget_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '进行中',
      detail TEXT NOT NULL DEFAULT '',
      updated_by_role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS project_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES family_projects(id) ON DELETE CASCADE,
      expense_date TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '',
      updated_by_role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_project_expenses_project_date ON project_expenses(project_id, expense_date)").run();
  await env.DB.prepare("PRAGMA optimize").run();
  await env.DB.prepare(`
    INSERT INTO family_projects (name, budget_cents, status, detail, updated_by_role)
    SELECT '新房装修', 0, '进行中', '我们家的第一个大额专项', 'system'
    WHERE NOT EXISTS (SELECT 1 FROM family_projects)
  `).run();
}

export function ensureFamilyFinanceSchema() {
  familyFinanceSchemaPromise ??= initializeFamilyFinanceSchema().catch((error) => {
    familyFinanceSchemaPromise = null;
    throw error;
  });
  return familyFinanceSchemaPromise;
}
