import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { COLUMNS, TABLES, validateSnapshot, planMerge, mergeStatements, snapshotSql, sequenceSql } from '../db/transfer-model.mjs';

const time = '2026-08-13 02:40:23';
const ledger = (id, extra = {}) => ({ id, source_key: null, kind: 'income', owner: 'zcy', entry_date: '2026-07-31', month: null, title: '收入', category: '工资', amount_cents: 123456, detail: '原始说明', payer: 'family', gift_type: null, source: 'manual', created_by_role: 'zcy', created_at: time, updated_at: time, ...extra });
const project = (id, extra = {}) => ({ id, name: '新房装修', budget_cents: 35000000, status: '进行中', detail: '我们家的第一个大额专项', updated_by_role: 'django', created_at: time, updated_at: time, ...extra });
const saving = (id, extra = {}) => ({ id, name: '存款', category: '银行卡', balance_cents: 10001, detail: 'a\n中文"\\', updated_by_role: 'django', created_at: time, updated_at: time, ...extra });
const expense = (id, projectId, extra = {}) => ({ id, project_id: projectId, expense_date: '2026-08-13', title: '装修', category: '硬装', amount_cents: 12345, detail: '', updated_by_role: 'django', created_at: time, updated_at: time, ...extra });
function snapshot(rows = {}) { return validateSnapshot({ format: 'bookkeeping-backup-v1', tables: Object.fromEntries(TABLES.map(t => [t, { columns: COLUMNS[t], rows: rows[t] ?? [] }])) }); }
function database(input) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const table of ['ledger_entries', 'savings_accounts', 'family_projects', 'project_expenses']) {
    db.exec(`CREATE TABLE ${table} (${COLUMNS[table].map(c => c === 'id' ? 'id INTEGER PRIMARY KEY AUTOINCREMENT' : `${c} ${c.endsWith('_cents') || c === 'project_id' ? 'INTEGER' : 'TEXT'}${c === 'source_key' ? ' UNIQUE' : c === 'project_id' ? ' REFERENCES family_projects(id)' : ''}`).join(',')})`);
    for (const row of input.tables[table].rows) db.prepare(`INSERT INTO ${table} (${COLUMNS[table].join(',')}) VALUES (${COLUMNS[table].map(() => '?').join(',')})`).run(...COLUMNS[table].map(c => row[c]));
  }
  return db;
}
function read(db) {
  const raw = {}, sequences = {}, tables = {};
  for (const table of TABLES) {
    raw[table] = db.prepare(snapshotSql(table)).get()[Object.keys(db.prepare(snapshotSql(table)).get())[0]];
    sequences[table] = Object.values(db.prepare(sequenceSql(table)).get())[0];
    tables[table] = { columns: COLUMNS[table], rows: db.prepare(`SELECT * FROM ${table} ORDER BY id`).all().map(r => ({ ...r })) };
  }
  return { raw, sequences, snapshot: snapshot(Object.fromEntries(TABLES.map(t => [t, tables[t].rows]))) };
}
function apply(db, statements) {
  db.exec('BEGIN');
  try { for (const s of statements) db.prepare(s.sql).all(...s.params); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

test('merges all owners, preserves original fields, IDs and project relationships; repeat is a no-op', () => {
  const target = snapshot({ ledger_entries: [ledger(20)], family_projects: [project(7, { budget_cents: 0, updated_by_role: 'system' })] });
  const source = snapshot({ ledger_entries: [ledger(1), ledger(2, { owner: 'django', title: '另一人', created_by_role: 'django' }), ledger(3, { kind: 'child_expense', owner: 'family', title: '小宝' })], savings_accounts: [saving(1)], family_projects: [project(1)], project_expenses: [expense(1, 1)] });
  const db = database(target), before = read(db), plan = planMerge(source, before.snapshot, before.sequences);
  assert.equal(plan.conflicts.length, 0);
  apply(db, mergeStatements(before, plan));
  const after = read(db);
  assert.deepEqual(after.snapshot.tables.ledger_entries.rows.find(r => r.id === 20), target.tables.ledger_entries.rows[0]);
  assert.equal(after.snapshot.tables.ledger_entries.rows.length, 3);
  assert.equal(after.snapshot.tables.project_expenses.rows[0].project_id, 7);
  assert.equal(after.snapshot.tables.savings_accounts.rows[0].detail, saving(1).detail);
  assert.equal(after.snapshot.tables.family_projects.rows[0].budget_cents, 35000000);
  assert.equal(planMerge(source, after.snapshot, after.sequences).operations.length, 0);
  db.close();
});
test('preserves genuine repeated identical rows as a multiset', () => {
  const plan = planMerge(snapshot({ ledger_entries: [ledger(1), ledger(2)] }), snapshot({ ledger_entries: [ledger(9)] }));
  assert.equal(plan.counts.ledger_entries.matched, 1);
  assert.equal(plan.counts.ledger_entries.added, 1);
});
test('source key changes, weak identity edits and account differences block the entire batch', () => {
  for (const [source, target] of [
    [snapshot({ ledger_entries: [ledger(1, { source_key: 'feishu-1' })] }), snapshot({ ledger_entries: [ledger(8, { source_key: 'feishu-1', amount_cents: 200 })] })],
    [snapshot({ ledger_entries: [ledger(1)] }), snapshot({ ledger_entries: [ledger(8, { detail: '修改过' })] })],
    [snapshot({ savings_accounts: [saving(1)] }), snapshot({ savings_accounts: [saving(9, { balance_cents: 200 })] })],
  ]) { const plan = planMerge(source, target); assert.ok(plan.conflicts.length); assert.throws(() => mergeStatements({}, plan)); }
});
test('never fills a user-created zero-budget project or a project with expenses', () => {
  for (const target of [snapshot({ family_projects: [project(1, { budget_cents: 0 })] }), snapshot({ family_projects: [project(1, { budget_cents: 0, updated_by_role: 'system' })], project_expenses: [expense(1, 1)] })]) {
    assert.ok(planMerge(snapshot({ family_projects: [project(2)] }), target).conflicts.length);
  }
});
test('validates missing tables, duplicate ids, invalid cents and orphan projects without truncation', () => {
  assert.throws(() => validateSnapshot({ format: 'bookkeeping-backup-v1', tables: {} }));
  assert.throws(() => snapshot({ savings_accounts: [saving(1), saving(1)] }));
  assert.throws(() => snapshot({ savings_accounts: [saving(1, { balance_cents: 0.1 })] }));
  assert.throws(() => snapshot({ project_expenses: [expense(1, 99)] }));
  assert.throws(() => snapshot({ ledger_entries: [ledger(1, { owner: 'invalid' })] }));
  assert.doesNotThrow(() => snapshot({ ledger_entries: [ledger(1, { kind: 'large_expense', amount_cents: -100 })] }));
});
test('guard detects concurrent updates, deletions and changed autoincrement sequence', () => {
  for (const change of ["UPDATE savings_accounts SET balance_cents=20 WHERE id=1", 'DELETE FROM savings_accounts WHERE id=1', "UPDATE sqlite_sequence SET seq=50 WHERE name='savings_accounts'"]) {
    const db = database(snapshot({ savings_accounts: [saving(1)] }));
    const before = read(db), source = snapshot({ savings_accounts: [saving(1), saving(2, { name: '另一个账户' })] });
    const statements = mergeStatements(before, planMerge(source, before.snapshot, before.sequences));
    db.exec(change); const changed = read(db);
    assert.throws(() => apply(db, statements));
    assert.deepEqual(read(db).raw, changed.raw);
    db.close();
  }
});
test('a later insert failure rolls back earlier insert groups', () => {
  const db = database(snapshot()), before = read(db);
  const source = snapshot({ savings_accounts: [saving(1)], family_projects: [project(1)], project_expenses: [expense(1, 1)] });
  const statements = mergeStatements(before, planMerge(source, before.snapshot, before.sequences));
  statements.push({ sql: 'SELECT json(?)', params: ['deliberate invalid JSON'] });
  assert.throws(() => apply(db, statements));
  assert.deepEqual(read(db).raw, before.raw);
  db.close();
});
test('allocates above historical sequence and refuses replay of a stale plan', () => {
  const db = database(snapshot({ savings_accounts: [saving(50)] })); db.exec('DELETE FROM savings_accounts');
  const before = read(db), source = snapshot({ savings_accounts: [saving(1)] });
  const plan = planMerge(source, before.snapshot, before.sequences);
  assert.equal(plan.operations[0].row.id, 51);
  const statements = mergeStatements(before, plan); apply(db, statements);
  assert.throws(() => apply(db, statements));
  assert.equal(read(db).snapshot.tables.savings_accounts.rows.length, 1); db.close();
});
