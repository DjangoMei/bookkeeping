import { getRawDb } from ".";
import { COLUMNS, TABLES, planMerge, summarize, validateSnapshot, snapshotSql, sequenceSql, mergeStatements } from "./transfer-model.mjs";
import { digest } from "../app/transfer-auth";

type Table = keyof typeof COLUMNS;
type Row = Record<string, string | number | null>;
export type Snapshot = { format: string; source: Record<string, unknown>; tables: Record<Table, { columns: string[]; rows: Row[] }> };

const names = TABLES as Table[];

export async function readSnapshot(host: string) {
  // One read-only batch gives a consistent cross-table backup. Do not run seeds here.
  const db = getRawDb().withSession("first-primary");
  const results = await db.batch(names.map(table => db.prepare(`SELECT (${snapshotSql(table)}) AS payload, (${sequenceSql(table)}) AS sequence`)));
  const tables = {} as Snapshot["tables"];
  const raw = {} as Record<Table, string>;
  const sequences = {} as Record<Table, number>;
  names.forEach((table, index) => {
    const result = results[index].results[0] as { payload: string; sequence: number };
    raw[table] = result.payload;
    sequences[table] = result.sequence;
    tables[table] = { columns: COLUMNS[table], rows: (JSON.parse(result.payload) as (string | number | null)[][]).map(values => Object.fromEntries(COLUMNS[table].map((c, i) => [c, values[i]]))) };
  });
  const snapshot: Snapshot = { format: "bookkeeping-backup-v1", source: { host, retrievedAt: new Date().toISOString() }, tables };
  validateSnapshot(snapshot);
  return { snapshot, raw, sequences, hash: await digest(JSON.stringify({ raw, sequences })) };
}

export async function applyMerge(target: Awaited<ReturnType<typeof readSnapshot>>, plan: ReturnType<typeof planMerge>) {
  if (plan.conflicts.length) throw new Error("存在冲突，未修改任何账目。");
  const db = getRawDb().withSession("first-primary");
  const statements = mergeStatements(target, plan);
  await db.batch(statements.map(s => db.prepare(s.sql).bind(...s.params)));
}

export { planMerge, summarize, validateSnapshot };
