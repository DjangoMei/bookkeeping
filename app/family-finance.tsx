"use client";

import { FormEvent, useMemo, useState } from "react";
import { withBasePath } from "./base-path";

export type SavingAccount = { id: number; name: string; category: string; balanceCents: number; detail: string; updatedByRole: string };
export type FamilyProject = { id: number; name: string; budgetCents: number; status: string; detail: string; updatedByRole: string };
export type ProjectExpense = { id: number; projectId: number; expenseDate: string; title: string; category: string; amountCents: number; detail: string; updatedByRole: string };
export type FamilyFinanceData = { savings: SavingAccount[]; projects: FamilyProject[]; expenses: ProjectExpense[] };

type View = "savings" | "projects";
type Editor = { entity: "saving" | "project" | "expense"; id: number | null } | null;

const savingCategories = ["余额宝", "银行卡", "公积金", "期权", "其他"];
const expenseCategories = ["设计", "硬装", "软装", "家电", "家具", "人工", "其他"];

function money(cents: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(cents / 100);
}

export default function FamilyFinance({ data, onChange, view }: { data: FamilyFinanceData; onChange: () => Promise<void>; view: View }) {
  const [editor, setEditor] = useState<Editor>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(data.projects[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedProject = data.projects.find((item) => item.id === selectedProjectId) ?? data.projects[0] ?? null;
  const projectExpenses = useMemo(() => data.expenses.filter((item) => item.projectId === selectedProject?.id), [data.expenses, selectedProject?.id]);
  const projectSpent = projectExpenses.reduce((sum, item) => sum + item.amountCents, 0);
  const editingSaving = editor?.entity === "saving" ? data.savings.find((item) => item.id === editor.id) : null;
  const editingProject = editor?.entity === "project" ? data.projects.find((item) => item.id === editor.id) : null;
  const editingExpense = editor?.entity === "expense" ? data.expenses.find((item) => item.id === editor.id) : null;
  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    payload.entity = editor.entity;
    setSaving(true); setMessage("");
    try {
      const suffix = editor.id ? `?entity=${editor.entity}&id=${editor.id}` : "";
      const response = await fetch(withBasePath(`/api/family-finance${suffix}`), { method: editor.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      setEditor(null); setMessage("已经同步进家庭账本啦。"); await onChange();
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }

  async function remove(entity: "saving" | "project" | "expense", id: number) {
    if (!window.confirm(entity === "project" ? "删除项目会同时删除全部专项明细，确定吗？" : "确定删除这条记录吗？")) return;
    const response = await fetch(withBasePath(`/api/family-finance?entity=${entity}&id=${id}`), { method: "DELETE" });
    if (response.ok) { if (entity === "project") setSelectedProjectId(null); await onChange(); }
    else setMessage("删除失败，请稍后再试。");
  }

  if (view === "savings") return (
    <section className="finance-workspace">
      <div className="finance-summary blue"><span>FAMILY SAVINGS</span><strong>{money(data.savings.reduce((sum, item) => sum + item.balanceCents, 0))}</strong><small>{data.savings.length} 个流动资金账户 · 两个人都能维护</small><button onClick={() => setEditor({ entity: "saving", id: null })} type="button">＋ 添加账户</button></div>
      <div className="finance-board">
        <div className="finance-board-head"><div><span className="section-kicker">AVAILABLE FUNDS</span><h2>我们的可支配存款</h2></div></div>
        {message && <p className="finance-message">{message}</p>}
        <div className="account-grid">
          {data.savings.map((item) => <article className="account-card" key={item.id}><span>{item.category}</span><h3>{item.name}</h3><strong>{money(item.balanceCents)}</strong><p>{item.detail || "暂无备注"}</p><div><button onClick={() => setEditor({ entity: "saving", id: item.id })} type="button">修改</button><button onClick={() => void remove("saving", item.id)} type="button">删除</button></div></article>)}
          {data.savings.length === 0 && <div className="finance-empty">还没有账户，从余额宝、银行卡或公积金开始记吧。</div>}
        </div>
      </div>
      {editor?.entity === "saving" && <FinanceEditor title={editingSaving ? "修改存款账户" : "添加存款账户"} onCancel={() => setEditor(null)} onSubmit={submit} saving={saving}><input name="entity" type="hidden" value="saving" /><FinanceField label="账户名称"><input defaultValue={editingSaving?.name ?? ""} name="name" placeholder="例如：家庭银行卡" required /></FinanceField><FinanceField label="资金类型"><select defaultValue={editingSaving?.category ?? "银行卡"} name="category">{savingCategories.map((item) => <option key={item}>{item}</option>)}</select></FinanceField><FinanceField label="当前余额（元）"><input defaultValue={editingSaving ? editingSaving.balanceCents / 100 : ""} min="0" name="balance" required step="0.01" type="number" /></FinanceField><FinanceField label="备注" wide><textarea defaultValue={editingSaving?.detail ?? ""} name="detail" rows={3} /></FinanceField></FinanceEditor>}
    </section>
  );

  return (
    <section className="finance-workspace projects-workspace">
      <div className="project-tabs"><button className="new-project" onClick={() => setEditor({ entity: "project", id: null })} type="button">＋ 新建专项</button>{data.projects.map((item) => <button className={selectedProject?.id === item.id ? "active" : ""} key={item.id} onClick={() => setSelectedProjectId(item.id)} type="button"><strong>{item.name}</strong><small>{item.status}</small></button>)}</div>
      {selectedProject ? <>
        <div className="project-hero"><div><span className="section-kicker">FAMILY PROJECT</span><h2>{selectedProject.name}</h2><p>{selectedProject.detail || "把大目标拆成每一笔清楚的小账。"}</p></div><div className="project-numbers"><div><span>项目预算</span><strong>{money(selectedProject.budgetCents)}</strong></div><div><span>已经支出</span><strong>{money(projectSpent)}</strong></div><div><span>预算剩余</span><strong>{money(selectedProject.budgetCents - projectSpent)}</strong></div></div><div className="project-progress"><i style={{ width: `${selectedProject.budgetCents ? Math.min(projectSpent / selectedProject.budgetCents * 100, 100) : 0}%` }} /></div><div className="project-actions"><button onClick={() => setEditor({ entity: "project", id: selectedProject.id })} type="button">修改项目</button><button onClick={() => setEditor({ entity: "expense", id: null })} type="button">＋ 记一笔专项支出</button></div></div>
        {message && <p className="finance-message">{message}</p>}
        <div className="finance-board project-records"><div className="finance-board-head"><div><span className="section-kicker">PROJECT NOTES</span><h2>专项明细</h2></div></div><div className="table-wrap"><table><thead><tr><th>日期</th><th>事项</th><th>分类</th><th className="amount">金额</th><th>操作</th></tr></thead><tbody>{projectExpenses.map((item) => <tr key={item.id}><td>{item.expenseDate}</td><td><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</td><td><span className="tag">{item.category}</span></td><td className="amount">{money(item.amountCents)}</td><td><button className="edit-button" onClick={() => setEditor({ entity: "expense", id: item.id })} type="button">改</button><button className="delete-button" onClick={() => void remove("expense", item.id)} type="button">×</button></td></tr>)}</tbody></table>{projectExpenses.length === 0 && <div className="finance-empty">这个项目还没有支出明细。</div>}</div></div>
      </> : <div className="finance-empty">先新建一个家庭大额专项吧。</div>}
      {editor?.entity === "project" && <FinanceEditor title={editingProject ? "修改大额专项" : "新建大额专项"} onCancel={() => setEditor(null)} onSubmit={submit} saving={saving}><FinanceField label="项目名称"><input defaultValue={editingProject?.name ?? ""} name="name" placeholder="例如：新房装修" required /></FinanceField><FinanceField label="总预算（元）"><input defaultValue={editingProject ? editingProject.budgetCents / 100 : ""} min="0" name="budget" required step="0.01" type="number" /></FinanceField><FinanceField label="状态"><select defaultValue={editingProject?.status ?? "进行中"} name="status"><option>筹备中</option><option>进行中</option><option>已完成</option><option>已暂停</option></select></FinanceField><FinanceField label="项目说明" wide><textarea defaultValue={editingProject?.detail ?? ""} name="detail" rows={3} /></FinanceField>{editingProject && <button className="danger-action" onClick={() => void remove("project", editingProject.id)} type="button">删除整个项目</button>}</FinanceEditor>}
      {editor?.entity === "expense" && selectedProject && <FinanceEditor title={editingExpense ? "修改专项支出" : `记入${selectedProject.name}`} onCancel={() => setEditor(null)} onSubmit={submit} saving={saving}><input name="projectId" type="hidden" value={selectedProject.id} /><FinanceField label="日期"><input defaultValue={editingExpense?.expenseDate ?? today} name="expenseDate" required type="date" /></FinanceField><FinanceField label="支出事项"><input defaultValue={editingExpense?.title ?? ""} name="title" required /></FinanceField><FinanceField label="分类"><select defaultValue={editingExpense?.category ?? "硬装"} name="category">{expenseCategories.map((item) => <option key={item}>{item}</option>)}</select></FinanceField><FinanceField label="金额（元）"><input defaultValue={editingExpense ? editingExpense.amountCents / 100 : ""} min="0" name="amount" required step="0.01" type="number" /></FinanceField><FinanceField label="备注" wide><textarea defaultValue={editingExpense?.detail ?? ""} name="detail" rows={3} /></FinanceField></FinanceEditor>}
    </section>
  );
}

function FinanceField({ children, label, wide }: { children: React.ReactNode; label: string; wide?: boolean }) { return <label className={wide ? "field field-wide" : "field"}><span>{label}</span>{children}</label>; }
function FinanceEditor({ children, onCancel, onSubmit, saving, title }: { children: React.ReactNode; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; title: string }) { return <div className="finance-editor"><div className="finance-editor-head"><h2>{title}</h2><button onClick={onCancel} type="button">×</button></div><form onSubmit={onSubmit}><div className="form-grid">{children}</div><div className="form-foot"><span>保存后两个人都会立即看到</span><div><button className="cancel-button" onClick={onCancel} type="button">取消</button><button className="primary-button" disabled={saving} type="submit">{saving ? "正在保存…" : "保存"}</button></div></div></form></div>; }
