import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { seedFeishuEntries } from "./feishu-seed";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensureLedgerSchema() {
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
      gift_type TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_by_role TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await seedFeishuEntries(env.DB);
}
