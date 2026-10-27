// Pure merge planning. No database writes, deletes, or implicit conflict resolution.
export const COLUMNS = {
  ledger_entries: ['id', 'source_key', 'kind', 'owner', 'entry_date', 'month', 'title', 'category', 'amount_cents', 'detail', 'payer', 'gift_type', 'source', 'created_by_role', 'created_at', 'updated_at'],
  savings_accounts: ['id', 'name', 'category', 'balance_cents', 'detail', 'updated_by_role', 'created_at', 'updated_at'],
  family_projects: ['id', 'name', 'budget_cents', 'status', 'detail', 'updated_by_role', 'created_at', 'updated_at'],
  project_expenses: ['id', 'project_id', 'expense_date', 'title', 'category', 'amount_cents', 'detail', 'updated_by_role', 'created_at', 'updated_at'],
};
export const TABLES = Object.keys(COLUMNS);
export const snapshotSql = table => `SELECT json_group_array(json_array(${COLUMNS[table].join(',')})) FROM (SELECT * FROM ${table} ORDER BY id)`;
export const sequenceSql = table => `SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = '${table}'), 0)`;
const BUSINESS = {
  ledger_entries: ['kind', 'owner', 'entry_date', 'month', 'title', 'category', 'amount_cents', 'detail', 'payer', 'gift_type'],
  savings_accounts: ['name', 'category', 'balance_cents', 'detail'],
  family_projects: ['name', 'budget_cents', 'status', 'detail'],
  project_expenses: ['project_id', 'expense_date', 'title', 'category', 'amount_cents', 'detail'],
};
const WEAK = {
  ledger_entries: ['kind', 'owner', 'entry_date', 'title'],
  savings_accounts: ['name'],
  family_projects: ['name'],
  project_expenses: ['project_id', 'expense_date', 'title'],
};
const nullable = new Set(['source_key', 'month', 'gift_type']);
const integerFields = new Set(['id', 'project_id', 'balance_cents', 'budget_cents', 'amount_cents']);
const fingerprint = (row, fields) => JSON.stringify(fields.map(field => row[field]));

export function validateSnapshot(input) {
  if (!input || !['bookkeeping-backup-v1', 'bookkeeping-sites-db-snapshot-v1'].includes(input.format) || !input.tables) {
    throw new Error('请选择完整的账本备份文件。');
  }
  const tables = {};
  let total = 0;
  for (const table of TABLES) {
    const data = input.tables[table];
    if (!data || !Array.isArray(data.rows) || !Array.isArray(data.columns) || data.columns.length !== COLUMNS[table].length || COLUMNS[table].some(c => !data.columns.includes(c))) {
      throw new Error(`备份表 ${table} 不完整或版本不兼容。`);
    }
    total += data.rows.length;
    if (total > 2000) throw new Error('此入口最多处理 2000 条记录，请使用数据库级迁移。');
    const ids = new Set(), sourceKeys = new Set();
    tables[table] = { columns: COLUMNS[table], rows: data.rows.map(original => {
      if (!original || Object.keys(original).length !== COLUMNS[table].length) throw new Error(`${table} 存在缺失或未知字段。`);
      const row = {};
      for (const column of COLUMNS[table]) {
        const value = original[column];
        if (value === null && nullable.has(column)) { row[column] = null; continue; }
        if (integerFields.has(column)) {
          if (!Number.isSafeInteger(value) || Math.abs(value) > 1e14 || (['id', 'project_id'].includes(column) && value <= 0)) throw new Error(`${table}.${column} 不是有效整数。`);
          if (value < 0 && !(table === 'ledger_entries' && column === 'amount_cents' && original.kind === 'large_expense')) throw new Error(`${table}.${column} 不允许负数。`);
        } else if (typeof value !== 'string' || value.length > 4000) throw new Error(`${table}.${column} 不是有效文本。`);
        row[column] = value;
      }
      if (ids.has(row.id)) throw new Error(`${table} 有重复记录编号。`);
      ids.add(row.id);
      if (table === 'ledger_entries') {
        if (!['zcy', 'django', 'family'].includes(row.owner) || !['income', 'large_expense', 'partner_gift', 'child_expense', 'abnormal_month', 'gift'].includes(row.kind) || !['family', 'mother'].includes(row.payer)) throw new Error('账目归属或类型无效。');
        if (row.kind === 'partner_gift' && !['zcy', 'django'].includes(row.owner)) throw new Error('互赠礼物必须归属具体收礼人。');
        if (row.source_key !== null) {
          if (!row.source_key || sourceKeys.has(row.source_key)) throw new Error('账目来源编号重复或为空。');
          sourceKeys.add(row.source_key);
        }
      }
      return row;
    }).sort((a, b) => a.id - b.id) };
  }
  const projectIds = new Set(tables.family_projects.rows.map(r => r.id));
  if (tables.project_expenses.rows.some(r => !projectIds.has(r.project_id))) throw new Error('专项明细引用了备份中不存在的项目。');
  return { format: 'bookkeeping-backup-v1', source: input.source ?? {}, tables };
}

export function summarize(snapshot) {
  return Object.fromEntries(TABLES.map(table => {
    const rows = snapshot.tables[table].rows;
    const field = table === 'savings_accounts' ? 'balance_cents' : table === 'family_projects' ? 'budget_cents' : 'amount_cents';
    return [table, { count: rows.length, cents: rows.reduce((sum, row) => sum + row[field], 0) }];
  }));
}

export function planMerge(source, target, sequences = {}) {
  const operations = [], conflicts = [], matches = [];
  const counts = Object.fromEntries(TABLES.map(t => [t, { added: 0, matched: 0, initialized: 0 }]));
  const projectMap = new Map();
  for (const table of ['family_projects', 'savings_accounts', 'ledger_entries', 'project_expenses']) {
    const targetRows = target.tables[table].rows;
    const used = new Set();
    let nextId = Math.max(sequences[table] ?? 0, 0, ...targetRows.map(r => r.id)) + 1;
    for (const original of source.tables[table].rows) {
      const row = { ...original };
      if (table === 'project_expenses') {
        if (!projectMap.has(row.project_id)) {
          conflicts.push({ table, sourceId: row.id, source: row, candidates: [], reason: '所属项目尚有冲突' });
          continue;
        }
        row.project_id = projectMap.get(row.project_id);
      }
      const key = fingerprint(row, BUSINESS[table]);
      const strong = table === 'ledger_entries' && row.source_key ? targetRows.find(r => r.source_key === row.source_key) : null;
      let match = strong && fingerprint(strong, BUSINESS[table]) === key && !used.has(strong.id) ? strong : null;
      if (!strong) match = targetRows.find(r => !used.has(r.id) && fingerprint(r, BUSINESS[table]) === key && !(table === 'ledger_entries' && row.source_key && r.source_key && r.source_key !== row.source_key));
      if (match) {
        used.add(match.id);
        matches.push({ table, sourceId: original.id, targetId: match.id });
        counts[table].matched++;
        if (table === 'family_projects') projectMap.set(original.id, match.id);
        continue;
      }
      const weakKey = fingerprint(row, WEAK[table]);
      const candidates = strong ? [strong] : targetRows.filter(r => fingerprint(r, WEAK[table]) === weakKey && fingerprint(r, BUSINESS[table]) !== key);
      const placeholder = table === 'family_projects' && candidates.length === 1 && source.tables.family_projects.rows.filter(r => r.name === row.name).length === 1 && targetRows.filter(r => r.name === row.name).length === 1 && candidates[0].name === '新房装修' && candidates[0].budget_cents === 0 && candidates[0].status === '进行中' && candidates[0].detail === '我们家的第一个大额专项' && candidates[0].updated_by_role === 'system' && !target.tables.project_expenses.rows.some(r => r.project_id === candidates[0].id);
      if (placeholder) {
        const targetId = candidates[0].id;
        operations.push({ table, type: 'initialize', sourceId: original.id, row: { ...row, id: targetId } });
        counts[table].initialized++;
        projectMap.set(original.id, targetId);
        used.add(targetId);
      } else if (candidates.length || strong) {
        conflicts.push({ table, sourceId: original.id, source: row, candidates, reason: '同一来源或相似记录内容不同；不会自动覆盖或重复计入' });
      } else {
        const inserted = { ...row, id: nextId++ };
        operations.push({ table, type: 'insert', sourceId: original.id, row: inserted });
        counts[table].added++;
        if (table === 'family_projects') projectMap.set(original.id, inserted.id);
      }
    }
  }
  return { counts, operations, conflicts, matches };
}

export function mergeStatements(target, plan) {
  if (plan.conflicts.length) throw new Error('存在冲突，未修改任何账目。');
  const statements = TABLES.map(table => ({
    sql: `SELECT CASE WHEN (${snapshotSql(table)}) = ? AND (${sequenceSql(table)}) = ? THEN 1 ELSE json('transfer_snapshot_changed') END`,
    params: [target.raw[table], target.sequences[table]],
  }));
  for (const table of ['family_projects', 'savings_accounts', 'ledger_entries', 'project_expenses']) {
    const rows = plan.operations.filter(o => o.table === table && o.type === 'insert').map(o => o.row);
    if (rows.length) statements.push({
      sql: `INSERT INTO ${table} (${COLUMNS[table].join(',')}) SELECT ${COLUMNS[table].map(c => `json_extract(value, '$.${c}')`).join(',')} FROM json_each(?)`,
      params: [JSON.stringify(rows)],
    });
    for (const operation of plan.operations.filter(o => o.table === table && o.type === 'initialize')) {
      const columns = COLUMNS[table].filter(c => c !== 'id');
      statements.push({ sql: `UPDATE ${table} SET ${columns.map(c => `${c} = ?`).join(',')} WHERE id = ?`, params: [...columns.map(c => operation.row[c]), operation.row.id] });
    }
  }
  return statements;
}
