"use client";

import { useState } from "react";
import { withBasePath } from "../base-path";
import styles from "./transfer.module.css";

type Counts = Record<string, { count: number; cents: number }>;
type Preview = {
  backup: unknown; backupHash: string; token: string;
  sourceSummary: Counts; targetSummary: Counts;
  plan: { counts: Record<string, { added: number; matched: number; initialized: number }>; conflicts: unknown[]; operations: unknown[]; matches: unknown[] };
};
const labels: Record<string, string> = { ledger_entries: "全部日常账目（两人及家庭）", savings_accounts: "家庭存款", family_projects: "大额专项", project_expenses: "专项支出" };

function download(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function TransferPanel() {
  const [passphrase, setPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [summary, setSummary] = useState<Counts | null>(null);

  async function request(payload: Record<string, unknown>) {
    const response = await fetch(withBasePath("/api/data-transfer"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 403) setUnlocked(false);
      throw new Error(data.error ?? "操作失败");
    }
    return data;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "操作未完成，请先重新预览核对数据。"); }
    finally { setBusy(false); }
  }
  function replaceInput(value: string) { setInput(value); setPreview(null); setSaved(false); setConfirm(""); }

  return <main className={styles.page}>
    <a href={withBasePath("/")}>← 返回账本</a>
    <h1>账本备份与合并</h1>
    <p>包含两人的个人账目、家庭共享账目、存款和专项。备份文件含私人财务信息，请保存在自己的设备上。</p>
    {!unlocked ? <form className={styles.card} onSubmit={event => { event.preventDefault(); void run(async () => { await request({ action: "unlock", passphrase }); setPassphrase(""); setUnlocked(true); }); }}>
      <h2>确认管理权限</h2>
      <label>再次输入账本口令<input autoComplete="off" name="transfer-passphrase" type="password" required value={passphrase} onChange={e => setPassphrase(e.target.value)} /></label>
      <button className="primary-button" disabled={busy} type="submit">{busy ? "验证中…" : "解锁备份与合并"}</button>
      <p>管理授权有效期为 15 分钟；退出或重新登录后需要重新验证。</p>
    </form> : <>
      <section className={styles.card}>
        <h2>1. 保存当前网站的全量备份</h2>
        <p>这里只备份当前网址使用的数据库，不会修改账目。</p>
        <button disabled={busy} onClick={() => void run(async () => { const data = await request({ action: "backup" }); setSummary(data.summary); download(data.backup, `bookkeeping-${location.hostname}-${Date.now()}.json`); setMessage("全量备份已生成，请确认浏览器已保存下载文件。"); })}>下载当前全量备份</button>
      </section>
      <section className={styles.card}>
        <h2>2. 读取另一端备份，预览差异</h2>
        <p>不删除当前记录、不自动覆盖冲突。相同内容按记录数量匹配；无法仅凭内容判断的两笔独立付款，需要人工核对。</p>
        <label>选择 JSON 备份文件<input accept="application/json,.json" type="file" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > 1900000) throw new Error("文件过大，请使用数据库级迁移。"); replaceInput(await file.text()); }); }} /></label>
        <details><summary>或粘贴备份 JSON</summary><label>备份内容<textarea rows={6} spellCheck={false} value={input} onChange={e => replaceInput(e.target.value)} /></label></details>
        <p>{input ? `已载入备份（${input.length.toLocaleString()} 字符）` : "尚未选择备份文件"}</p>
        <button disabled={busy || !input} onClick={() => void run(async () => { setPreview(null); setSaved(false); setConfirm(""); const data = await request({ action: "preview", snapshot: JSON.parse(input) }); setPreview(data); setSummary(data.targetSummary); setMessage(data.plan.conflicts.length ? "发现冲突，合并已被阻止，请下载差异清单核对。" : "预览完成，尚未写入任何数据。"); })}>预览合并（不写入）</button>
      </section>
      {preview && <section className={styles.card}>
        <h2>3. 核对并合并</h2>
        <div className={styles.scroll}><table><thead><tr><th>数据</th><th>当前</th><th>来源</th><th>相同跳过</th><th>新增</th><th>填充空项目</th></tr></thead><tbody>{Object.entries(preview.plan.counts).map(([table, counts]) => <tr key={table}><td>{labels[table]}</td><td>{preview.targetSummary[table].count}</td><td>{preview.sourceSummary[table].count}</td><td>{counts.matched}</td><td>{counts.added}</td><td>{counts.initialized}</td></tr>)}</tbody></table></div>
        <button onClick={() => download(preview.plan, `bookkeeping-merge-plan-${Date.now()}.json`)}>下载完整差异清单</button>
        {preview.plan.conflicts.length > 0 ? <><p role="alert">有 {preview.plan.conflicts.length} 条内容冲突，本批次不会写入。</p><pre className={styles.conflicts}>{JSON.stringify(preview.plan.conflicts, null, 2)}</pre></> : <>
          <p>仅会新增缺失记录，以及填充系统创建、无明细的默认零预算“新房装修”项目。</p>
          <button onClick={() => { download(preview.backup, `bookkeeping-before-merge-${Date.now()}.json`); setSaved(true); }}>保存本次合并前备份</button>
          <label className={styles.check}><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />我已保存本次合并前的完整备份</label>
          <label>输入“合并缺失数据”确认<input value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" /></label>
          <button className="primary-button" disabled={busy || !saved || confirm !== "合并缺失数据"} onClick={() => void run(async () => {
            const pending = preview; setPreview(null); setSaved(false); setConfirm("");
            const data = await request({ action: "apply", snapshot: JSON.parse(input), token: pending.token, backupHash: pending.backupHash, confirm });
            setSummary(data.summary); download(data.backup, `bookkeeping-after-merge-${Date.now()}.json`);
            setMessage(data.verified ? "合并完成：来源记录已全部匹配，未删除现有账目。合并后备份已生成。" : "合并已提交，但复核发现变化。请先下载当前备份核对，不要重复提交。");
          })}>{busy ? "处理中…" : "确认合并缺失数据"}</button>
        </>}
      </section>}
      {summary && <section className={styles.card}><h2>当前数据库汇总</h2><ul>{Object.entries(summary).map(([table, value]) => <li key={table}>{labels[table]}：{value.count} 条{table !== "ledger_entries" && ` · ¥${(value.cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`}</li>)}</ul></section>}
    </>}
    {message && <p className={styles.message} role="status">{message}</p>}
  </main>;
}
