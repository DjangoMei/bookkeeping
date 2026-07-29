"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { withBasePath } from "./base-path";
import { greetingForHour } from "./time-greeting";

type Role = "zcy" | "django";
type Kind =
  | "overview"
  | "income"
  | "large_expense"
  | "child_expense"
  | "abnormal_month"
  | "gift";

type Entry = {
  id: number;
  kind: Exclude<Kind, "overview">;
  owner: Role | "family";
  entryDate: string;
  month: string | null;
  title: string;
  category: string;
  amountCents: number;
  detail: string;
  giftType: string | null;
  source: "manual" | "feishu";
  createdByRole: Role | "system";
};

const tabs: Array<{ id: Kind; label: string; mark: string }> = [
  { id: "overview", label: "总览", mark: "览" },
  { id: "income", label: "收入", mark: "收" },
  { id: "large_expense", label: "大额消费", mark: "额" },
  { id: "child_expense", label: "孩子支出", mark: "孩" },
  { id: "abnormal_month", label: "异常月份", mark: "异" },
  { id: "gift", label: "人情明细", mark: "礼" },
];

const copy: Record<Exclude<Kind, "overview">, { title: string; description: string }> = {
  income: {
    title: "收入",
    description: "工资与额外收入分开记录，只显示当前用户自己的收入。",
  },
  large_expense: {
    title: "大额消费",
    description: "每年 6 月开启新周期，周期预算上限为 ¥50,000。",
  },
  child_expense: {
    title: "孩子支出",
    description: "教育、医疗、兴趣与日常支出集中记录。",
  },
  abnormal_month: {
    title: "异常月份",
    description: "自然信用卡月支出超过 ¥4,000 时，在这里登记原因。",
  },
  gift: {
    title: "人情明细",
    description: "记录收到的礼金、礼物及往来对象与场合。",
  },
};

function money(cents: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function currentCycle(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 5 ? year : year - 1;
  return {
    label: `${startYear}.06 — ${startYear + 1}.05`,
    start: `${startYear}-06-01`,
    end: `${startYear + 1}-05-31`,
  };
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field field-wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function LedgerApp() {
  const [active, setActive] = useState<Kind>("overview");
  const [role, setRole] = useState<Role>("zcy");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginRole, setLoginRole] = useState<Role>("zcy");
  const [passphrase, setPassphrase] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [kindToAdd, setKindToAdd] = useState<Exclude<Kind, "overview">>("income");
  const [greeting, setGreeting] = useState("你好，账目一切清楚。");
  const today = new Date().toISOString().slice(0, 10);

  async function load({
    allowUnauthenticated = false,
  }: { allowUnauthenticated?: boolean } = {}) {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(withBasePath("/api/ledger"));
      const data = (await response.json()) as { entries?: Entry[]; role?: Role; error?: string };
      if (!response.ok) {
        if (allowUnauthenticated && (response.status === 401 || response.status === 403)) {
          return false;
        }
        throw new Error(data.error || "读取账本失败");
      }
      setEntries(data.entries ?? []);
      if (data.role) setRole(data.role);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "读取账本失败");
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      const hasSession = await load({ allowUnauthenticated: true });
      setAuthenticated(hasSession);
      setSessionChecking(false);
    }
    void initialize();
  }, []);

  useEffect(() => {
    function updateGreeting() {
      setGreeting(greetingForHour(new Date().getHours()));
    }

    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const cycle = currentCycle();
  const largeEntries = entries.filter(
    (entry) =>
      entry.kind === "large_expense" &&
      entry.entryDate >= cycle.start &&
      entry.entryDate <= cycle.end,
  );
  const largeUsed = largeEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
  const incomeThisYear = entries
    .filter((entry) => entry.kind === "income" && entry.entryDate.startsWith(String(new Date().getFullYear())))
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const childThisYear = entries
    .filter(
      (entry) =>
        entry.kind === "child_expense" &&
        entry.entryDate.startsWith(String(new Date().getFullYear())),
    )
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const abnormalCount = entries.filter(
    (entry) =>
      entry.kind === "abnormal_month" &&
      entry.entryDate.startsWith(String(new Date().getFullYear())),
  ).length;
  const giftsThisYear = entries
    .filter(
      (entry) =>
        entry.kind === "gift" &&
        entry.entryDate.startsWith(String(new Date().getFullYear())),
    )
    .reduce((sum, entry) => sum + entry.amountCents, 0);

  const visibleEntries = useMemo(() => {
    if (active === "overview") return entries.slice(0, 8);
    return entries.filter((entry) => entry.kind === active);
  }, [active, entries]);

  function openAdd(kind?: Exclude<Kind, "overview">) {
    const target = kind ?? (active === "overview" ? "income" : active);
    setKindToAdd(target);
    setModalOpen(true);
    setNotice("");
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    setSaving(true);
    try {
      const response = await fetch(withBasePath("/api/ledger"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "保存失败");
      setModalOpen(false);
      await load();
      setNotice("已保存一条记录");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: number) {
    if (!window.confirm("确定删除这条记录吗？")) return;
    const response = await fetch(withBasePath(`/api/ledger?id=${id}`), {
      method: "DELETE",
    });
    if (response.ok) {
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setNotice("记录已删除");
    } else {
      const data = (await response.json()) as { error?: string };
      setNotice(data.error || "删除失败");
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch(withBasePath("/api/session"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: loginRole, passphrase }),
      });
      const data = (await response.json()) as { role?: Role; error?: string };
      if (!response.ok || !data.role) throw new Error(data.error || "登录失败");
      setRole(data.role);
      setAuthenticated(true);
      setPassphrase("");
      await load();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await fetch(withBasePath("/api/session"), { method: "DELETE" });
    setEntries([]);
    setAuthenticated(false);
    setPassphrase("");
    setNotice("");
  }

  const activeMeta = active === "overview" ? null : copy[active];
  const formMeta = copy[kindToAdd];

  if (!authenticated) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="login-brand">
            <div className="brand-seal">家</div>
            <div>
              <strong>家账</strong>
              <span>Family Ledger</span>
            </div>
          </div>
          <p className="eyebrow">私人家庭账本</p>
          <h1>欢迎回来。</h1>
          <p className="login-copy">选择你的账本身份，并输入家庭安全口令。</p>
          <form onSubmit={login}>
            <fieldset className="identity-picker">
              <legend>选择用户</legend>
              <button
                className={loginRole === "zcy" ? "chosen" : ""}
                onClick={() => setLoginRole("zcy")}
                type="button"
              >
                <span>Z</span>
                <strong>zcy</strong>
                <small>个人收入空间</small>
              </button>
              <button
                className={loginRole === "django" ? "chosen" : ""}
                onClick={() => setLoginRole("django")}
                type="button"
              >
                <span>D</span>
                <strong>Django</strong>
                <small>个人收入空间</small>
              </button>
            </fieldset>
            <label className="login-field">
              <span>安全口令</span>
              <input
                autoComplete="current-password"
                autoFocus
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="请输入口令"
                required
                type="password"
                value={passphrase}
              />
            </label>
            {(loginError || notice) && <div className="login-error">{loginError || notice}</div>}
            <button
              className="login-button"
              disabled={loggingIn || sessionChecking}
              type="submit"
            >
              {sessionChecking
                ? "正在检查已保存的登录状态…"
                : loggingIn
                  ? "正在进入…"
                  : `进入 ${loginRole} 的账本`}
            </button>
          </form>
          <footer>
            <span>个人收入彼此独立</span>
            <i />
            <span>家庭支出共同维护</span>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-seal">家</div>
          <div>
            <strong>家账</strong>
            <span>Family Ledger</span>
          </div>
        </div>

        <nav aria-label="账本功能">
          {tabs.map((tab) => (
            <button
              className={active === tab.id ? "nav-item active" : "nav-item"}
              key={tab.id}
              onClick={() => setActive(tab.id)}
              type="button"
            >
              <span className="nav-mark">{tab.mark}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <span>当前大额消费周期</span>
          <strong>{cycle.label}</strong>
          <div className="mini-progress">
            <i style={{ width: `${Math.min((largeUsed / 5_000_000) * 100, 100)}%` }} />
          </div>
          <small>{money(largeUsed)} / ¥50,000</small>
        </div>

        <div className="account">
          <div className="avatar">{role === "zcy" ? "Z" : "D"}</div>
          <div>
            <strong>{role}</strong>
            <span>个人账本空间</span>
          </div>
          <span className="online-dot" title="已登录" />
          <button className="logout-button" onClick={logout} title="退出登录" type="button">
            退出
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">家庭财务 · 清楚一点，安心一点</p>
            <h1>{activeMeta?.title ?? greeting}</h1>
            <p className="subtitle">
              {activeMeta?.description ?? "这是你们两个人共同维护、各自独立的家庭账本。"}
            </p>
          </div>
          <div className="top-actions">
            <button className="primary-button" onClick={() => openAdd()} type="button">
              <span>＋</span> 记一笔
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {active === "overview" && (
          <>
            <div className="metric-grid">
              <article className="metric-card dark">
                <span>今年我的收入</span>
                <strong>{money(incomeThisYear)}</strong>
                <small>{role} · 工资与额外收入</small>
                <div className="metric-glyph">收</div>
              </article>
              <article className="metric-card">
                <span>本周期大额消费</span>
                <strong>{money(largeUsed)}</strong>
                <small>剩余额度 {money(Math.max(5_000_000 - largeUsed, 0))}</small>
                <div className="metric-glyph clay">额</div>
              </article>
              <article className="metric-card">
                <span>今年孩子支出</span>
                <strong>{money(childThisYear)}</strong>
                <small>教育、医疗与成长日常</small>
                <div className="metric-glyph gold">孩</div>
              </article>
              <article className="metric-card">
                <span>异常月份 / 人情</span>
                <strong>{abnormalCount} <em>个月</em></strong>
                <small>今年收到 {money(giftsThisYear)}</small>
                <div className="metric-glyph soft">礼</div>
              </article>
            </div>

            <div className="overview-grid">
              <section className="panel budget-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-kicker">大额消费计划</span>
                    <h2>{cycle.label}</h2>
                  </div>
                  <button onClick={() => setActive("large_expense")} type="button">
                    查看明细 →
                  </button>
                </div>
                <div className="budget-visual">
                  <div className="ring" style={{ "--p": `${Math.min((largeUsed / 5_000_000) * 100, 100)}%` } as React.CSSProperties}>
                    <div>
                      <strong>{Math.round((largeUsed / 5_000_000) * 100)}%</strong>
                      <span>已使用</span>
                    </div>
                  </div>
                  <div className="budget-copy">
                    <p>周期预算</p>
                    <strong>¥50,000</strong>
                    <div className="budget-line">
                      <span>已登记</span>
                      <b>{largeEntries.length} 笔</b>
                    </div>
                    <div className="budget-line">
                      <span>预算状态</span>
                      <b className={largeUsed > 5_000_000 ? "danger" : "healthy"}>
                        {largeUsed > 5_000_000 ? "已超额" : "范围内"}
                      </b>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel quick-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-kicker">快速登记</span>
                    <h2>今天记什么？</h2>
                  </div>
                </div>
                <div className="quick-grid">
                  {tabs.slice(2).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => openAdd(tab.id as Exclude<Kind, "overview">)}
                      type="button"
                    >
                      <span>{tab.mark}</span>
                      <strong>{tab.label}</strong>
                      <small>新增记录</small>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        <section className="panel records-panel">
          <div className="panel-head records-head">
            <div>
              <span className="section-kicker">{active === "overview" ? "最近动态" : "记录明细"}</span>
              <h2>{active === "overview" ? "最近的账目" : `${activeMeta?.title}记录`}</h2>
            </div>
            {active !== "overview" && (
              <button className="outline-button" onClick={() => openAdd()} type="button">
                ＋ 新增
              </button>
            )}
          </div>

          {loading ? (
            <div className="empty">正在整理账目…</div>
          ) : visibleEntries.length === 0 ? (
            <div className="empty">
              <div className="empty-mark">记</div>
              <strong>这里还没有记录</strong>
              <span>飞书历史数据导入后会完整显示在这里。</span>
              <button onClick={() => openAdd()} type="button">先记一笔</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>项目</th>
                    <th>分类</th>
                    <th>归属</th>
                    <th>来源</th>
                    <th className="amount">金额</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.entryDate}</td>
                      <td>
                        <strong>{entry.title}</strong>
                        {entry.detail && <small>{entry.detail}</small>}
                      </td>
                      <td><span className="tag">{entry.category}</span></td>
                      <td>{entry.owner === "family" ? "家庭" : entry.owner}</td>
                      <td>
                        <span className={entry.source === "feishu" ? "source imported" : "source"}>
                          {entry.source === "feishu" ? "飞书导入" : "手动"}
                        </span>
                      </td>
                      <td className="amount">{money(entry.amountCents)}</td>
                      <td>
                        <button
                          aria-label={`删除 ${entry.title}`}
                          className="delete-button"
                          onClick={() => removeEntry(entry.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <section
            aria-labelledby="entry-form-title"
            aria-modal="true"
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-head">
              <div>
                <span className="section-kicker">新增记录</span>
                <h2 id="entry-form-title">{formMeta.title}</h2>
                <p>{formMeta.description}</p>
              </div>
              <button aria-label="关闭" onClick={() => setModalOpen(false)} type="button">×</button>
            </div>
            <form onSubmit={saveEntry}>
              <input name="kind" type="hidden" value={kindToAdd} />
              <div className="form-grid">
                <Field label="日期">
                  <input defaultValue={today} name="entryDate" required type="date" />
                </Field>
                {kindToAdd === "abnormal_month" && (
                  <Field label="信用卡自然月">
                    <input defaultValue={today.slice(0, 7)} name="month" required type="month" />
                  </Field>
                )}
                <Field label={kindToAdd === "gift" ? "送礼人 / 对象" : "项目"}>
                  <input
                    name="title"
                    placeholder={kindToAdd === "income" ? "例如：7 月工资" : "简要写下这笔账"}
                    required
                  />
                </Field>
                <Field label="金额（元）">
                  <input min="0" name="amount" placeholder="0.00" required step="0.01" type="number" />
                </Field>
                <Field label="分类">
                  <select name="category">
                    {kindToAdd === "income" && (
                      <>
                        <option>工资</option>
                        <option>额外收入</option>
                      </>
                    )}
                    {kindToAdd === "large_expense" && (
                      <>
                        <option>家电</option>
                        <option>旅行</option>
                        <option>家居</option>
                        <option>医疗</option>
                        <option>其他</option>
                      </>
                    )}
                    {kindToAdd === "child_expense" && (
                      <>
                        <option>教育</option>
                        <option>医疗</option>
                        <option>兴趣</option>
                        <option>日常</option>
                        <option>其他</option>
                      </>
                    )}
                    {kindToAdd === "abnormal_month" && (
                      <>
                        <option>大额购物</option>
                        <option>旅行</option>
                        <option>医疗</option>
                        <option>临时事项</option>
                        <option>其他</option>
                      </>
                    )}
                    {kindToAdd === "gift" && (
                      <>
                        <option>节庆</option>
                        <option>生日</option>
                        <option>婚礼</option>
                        <option>探望</option>
                        <option>其他</option>
                      </>
                    )}
                  </select>
                </Field>
                {kindToAdd === "gift" && (
                  <Field label="形式">
                    <select name="giftType">
                      <option>礼金</option>
                      <option>礼物</option>
                      <option>礼金＋礼物</option>
                    </select>
                  </Field>
                )}
                <Field label="备注" wide>
                  <textarea name="detail" placeholder="原因、场合或需要补充的细节" rows={3} />
                </Field>
              </div>
              <div className="form-foot">
                <span>
                  {kindToAdd === "income" ? `将归入 ${role} 的个人收入` : "将归入家庭共享账本"}
                </span>
                <div>
                  <button className="cancel-button" onClick={() => setModalOpen(false)} type="button">
                    取消
                  </button>
                  <button className="primary-button" disabled={saving} type="submit">
                    {saving ? "保存中…" : "保存记录"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
