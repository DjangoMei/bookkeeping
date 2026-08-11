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

const tabs: Array<{ id: Kind; label: string; mark: string; english: string }> = [
  { id: "overview", label: "首页", mark: "⌂", english: "HOME" },
  { id: "income", label: "收入", mark: "¥", english: "INCOME" },
  { id: "large_expense", label: "大额消费", mark: "★", english: "BIG BUY" },
  { id: "child_expense", label: "小宝花费", mark: "♡", english: "KIDDO" },
  { id: "abnormal_month", label: "特别月份", mark: "!", english: "SPECIAL" },
  { id: "gift", label: "人情往来", mark: "✦", english: "GIFTS" },
];

const copy: Record<Exclude<Kind, "overview">, { title: string; description: string }> = {
  income: { title: "收入小口袋", description: "工资和额外收入各自收好，只给当前的你看。" },
  large_expense: { title: "大件愿望单", description: "每年六月开启新周期，五万元预算慢慢花。" },
  child_expense: { title: "小宝成长簿", description: "教育、医疗、兴趣和可爱的日常，都记在这里。" },
  abnormal_month: { title: "特别月份", description: "开销超过四千元的月份，留下一张小纸条。" },
  gift: { title: "人情小本本", description: "礼金、礼物、对象和场合，一个都不忘。" },
};

const roleNames: Record<Role, { name: string; english: string; initial: string }> = {
  zcy: { name: "ZCY", english: "MY LEDGER", initial: "Z" },
  django: { name: "Django", english: "MY LEDGER", initial: "D" },
};

const mascotByPage: Record<Exclude<Kind, "overview">, { src: string; alt: string; note: string; second?: string }> = {
  income: { src: "/mascot-cutouts/01-playing-blocks.png", alt: "可乐开心地玩积木", note: "一块一块，把小收入搭起来" },
  large_expense: { src: "/mascot-cutouts/05-playing-ball.png", alt: "可乐开心地玩球", note: "大目标，也可以轻松慢慢来" },
  child_expense: { src: "/mascot-cutouts/06-bunny-tight-hug-v2.png", alt: "可乐贴脸抱紧兔兔玩偶", note: "小宝的成长，每一笔都值得收藏" },
  abnormal_month: { src: "/mascot-cutouts/08-crying.png", second: "/mascot-cutouts/09-angry.png", alt: "可乐哭哭和生气的表情", note: "偶尔超支也没关系，记清楚就好" },
  gift: { src: "/mascot-cutouts/07-eating-cake.png", alt: "可乐开心地吃蛋糕", note: "把甜甜的人情往来认真记住" },
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

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
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
  const [greeting, setGreeting] = useState("今天也要把小日子记得明明白白！");
  const today = new Date().toISOString().slice(0, 10);

  async function load({ allowUnauthenticated = false }: { allowUnauthenticated?: boolean } = {}) {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(withBasePath("/api/ledger"));
      const data = (await response.json()) as { entries?: Entry[]; role?: Role; error?: string };
      if (!response.ok) {
        if (allowUnauthenticated && (response.status === 401 || response.status === 403)) return false;
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
  const largeEntries = entries.filter((entry) => entry.kind === "large_expense" && entry.entryDate >= cycle.start && entry.entryDate <= cycle.end);
  const largeUsed = largeEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
  const year = String(new Date().getFullYear());
  const incomeThisYear = entries.filter((entry) => entry.kind === "income" && entry.entryDate.startsWith(year)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const childThisYear = entries.filter((entry) => entry.kind === "child_expense" && entry.entryDate.startsWith(year)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const abnormalCount = entries.filter((entry) => entry.kind === "abnormal_month" && entry.entryDate.startsWith(year)).length;
  const giftsThisYear = entries.filter((entry) => entry.kind === "gift" && entry.entryDate.startsWith(year)).reduce((sum, entry) => sum + entry.amountCents, 0);

  const visibleEntries = useMemo(() => active === "overview" ? entries.slice(0, 4) : entries.filter((entry) => entry.kind === active), [active, entries]);

  function openAdd(kind?: Exclude<Kind, "overview">) {
    setKindToAdd(kind ?? (active === "overview" ? "income" : active));
    setModalOpen(true);
    setNotice("");
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSaving(true);
    try {
      const response = await fetch(withBasePath("/api/ledger"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "保存失败");
      setModalOpen(false);
      await load();
      setNotice("叮！这笔已经收进 Cola 小账本啦。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: number) {
    if (!window.confirm("要把这条记录撕掉吗？")) return;
    const response = await fetch(withBasePath(`/api/ledger?id=${id}`), { method: "DELETE" });
    if (response.ok) {
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setNotice("这条记录已经移走啦。");
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
  const currentRole = roleNames[role];
  const activeMascot = active === "overview" ? null : mascotByPage[active];

  if (!authenticated) {
    return (
      <main className="login-shell">
        <div className="login-scribble login-scribble-one">COLA!</div>
        <div className="login-scribble login-scribble-two">♡ little days ♡</div>
        <section className="login-visual" aria-hidden="true">
          <div className="login-sticker">可乐的小日子</div>
          <img src={withBasePath("/mascot-cutouts/00-character-base.png")} alt="" fetchPriority="high" height={1254} width={1254} />
          <p>COZY DAYS<br />WITH COLA</p>
        </section>
        <section className="login-card">
          <div className="login-brand">
            <span className="brand-apple">●</span>
            <div><strong>Cola</strong><span>可乐小宝的家庭账本</span></div>
          </div>
          <p className="eyebrow">WELCOME BACK, CUTIE!</p>
          <h1>回来记小账啦</h1>
          <p className="login-copy">选好身份，再说出我们的秘密口令。</p>
          <form onSubmit={login}>
            <fieldset className="identity-picker">
              <legend>今天是谁来记账？</legend>
              {(Object.keys(roleNames) as Role[]).map((item) => {
                const meta = roleNames[item];
                return (
                  <button className={loginRole === item ? "chosen" : ""} key={item} onClick={() => setLoginRole(item)} type="button">
                    <span>{meta.initial}</span><strong>{meta.name}</strong><small>{meta.english}</small>
                  </button>
                );
              })}
            </fieldset>
            <label className="login-field">
              <span>秘密口令</span>
              <input autoComplete="current-password" onChange={(event) => setPassphrase(event.target.value)} placeholder="悄悄输入…" required type="password" value={passphrase} />
            </label>
            {(loginError || notice) && <div className="login-error">{loginError || notice}</div>}
            <button className="login-button" disabled={loggingIn || sessionChecking} type="submit">
              {sessionChecking ? "正在翻开小账本…" : loggingIn ? "马上进去…" : `进入 ${roleNames[loginRole].name} 的账本`}
            </button>
          </form>
          <footer><span>COLA</span><i /><span>可乐，也叫小宝</span><i /><span>OUR LITTLE DAYS</span></footer>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <a className="skip-link" href="#ledger-content">跳到主要内容</a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-seal">C</div>
          <div><strong>Cola</strong><span>可乐 · 小宝</span></div>
        </div>
        <nav aria-label="账本功能">
          {tabs.map((tab) => (
            <button className={active === tab.id ? "nav-item active" : "nav-item"} key={tab.id} onClick={() => setActive(tab.id)} type="button">
              <span className="nav-mark">{tab.mark}</span>
              <span className="nav-copy"><b>{tab.label}</b><small>{tab.english}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-mascot">
          <span>翻翻今天的<br />小账本</span>
          <img src={withBasePath("/mascot-cutouts/02-reading-picture-book.png")} alt="可乐坐着看图画书" height={1254} width={1254} />
        </div>
        <div className="sidebar-note">
          <span>BIG BUY PLAN</span><strong>{cycle.label}</strong>
          <div className="mini-progress"><i style={{ width: `${Math.min((largeUsed / 5_000_000) * 100, 100)}%` }} /></div>
          <small>{money(largeUsed)} / ¥50,000</small>
        </div>
        <div className="account">
          <div className="avatar">{currentRole.initial}</div>
          <div><strong>{currentRole.name}</strong><span>{currentRole.english} IS HERE!</span></div>
          <button className="logout-button" onClick={logout} title="退出登录" type="button">退出</button>
        </div>
      </aside>

      <section className={active === "overview" ? "content content-overview" : "content content-detail"} id="ledger-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">COLA&apos;S TINY LEDGER · 小日子收藏所</p>
            <h1>{activeMeta?.title ?? greeting}</h1>
            <p className="subtitle">{activeMeta?.description ?? `嗨，${currentRole.name}！把每一笔都变成可爱的生活碎片。`}</p>
          </div>
          <button className="primary-button" onClick={() => openAdd()} type="button"><span>＋</span> 记一笔</button>
        </header>

        {notice && <div aria-live="polite" className="notice" role="status">✦ {notice}</div>}

        {active === "overview" && (
          <>
            <section className="hero-card">
              <div className="hero-copy">
                <span className="hero-kicker">OUR LITTLE MONEY STORY</span>
                <h2>可乐小宝的 <em>小小生活账</em></h2>
                <p>认真生活，开心花钱，也别忘了把今天收进小本本。</p>
                <div className="hero-tags"><span>COLA</span><span>可乐</span><span>小宝</span></div>
              </div>
              <div className="hero-image-wrap">
                <span aria-hidden="true" className="spark spark-one">✦</span><span aria-hidden="true" className="spark spark-two">♡</span>
                <img src={withBasePath("/mascot-cutouts/04-watching-tv-excited-v2.png")} alt="小女孩兴奋地看电视跳舞" fetchPriority="high" height={1254} width={1254} />
              </div>
            </section>

            <div className="metric-grid">
              <article className="metric-card red"><span>MY INCOME</span><strong>{money(incomeThisYear)}</strong><small>{currentRole.name}今年的收入</small><b className="metric-stamp">01</b></article>
              <article className="metric-card cream"><span>BIG BUY</span><strong>{money(largeUsed)}</strong><small>还可以花 {money(Math.max(5_000_000 - largeUsed, 0))}</small><b className="metric-stamp">02</b></article>
              <article className="metric-card blue"><span>FOR BABY</span><strong>{money(childThisYear)}</strong><small>小宝今年的成长花费</small><b className="metric-stamp">03</b></article>
              <article className="metric-card cream"><span>SPECIAL &amp; GIFTS</span><strong>{abnormalCount}<em> 个月</em></strong><small>今年收到 {money(giftsThisYear)}</small><b className="metric-stamp">04</b></article>
            </div>

            <div className="overview-grid">
              <section className="panel budget-panel">
                <div className="panel-head"><div><span className="section-kicker">BIG BUY PLAN</span><h2>大件愿望进度</h2></div><button onClick={() => setActive("large_expense")} type="button">查看明细 ↗</button></div>
                <div className="budget-visual">
                  <div className="ring" style={{ "--p": `${Math.min((largeUsed / 5_000_000) * 100, 100)}%` } as React.CSSProperties}><div><strong>{Math.round((largeUsed / 5_000_000) * 100)}%</strong><span>已经用掉</span></div></div>
                  <div className="budget-copy"><p>本周期的小目标</p><strong>¥50,000</strong><div className="budget-line"><span>已经记下</span><b>{largeEntries.length} 笔</b></div><div className="budget-line"><span>现在状态</span><b className={largeUsed > 5_000_000 ? "danger" : "healthy"}>{largeUsed > 5_000_000 ? "哎呀，超额啦" : "稳稳的！"}</b></div></div>
                </div>
              </section>
              <section className="panel quick-panel">
                <div className="panel-head"><div><span className="section-kicker">QUICK NOTES</span><h2>今天记点什么？</h2></div></div>
                <div className="quick-mascots" aria-hidden="true">
                  <img src={withBasePath("/mascot-cutouts/03-drawing-playful-v2.png")} alt="" height={1254} loading="lazy" width={1254} />
                </div>
                <div className="quick-grid">
                  {tabs.slice(2).map((tab) => <button key={tab.id} onClick={() => openAdd(tab.id as Exclude<Kind, "overview">)} type="button"><span>{tab.mark}</span><strong>{tab.label}</strong><small>{tab.english}</small></button>)}
                </div>
              </section>
            </div>
          </>
        )}

        {activeMascot && (
          <section className="page-banner">
            <div>
              <span className="section-kicker">COLA&apos;S LITTLE MOMENT</span>
              <strong>{activeMascot.note}</strong>
            </div>
            <div className="page-banner-art">
              <img src={withBasePath(activeMascot.src)} alt={activeMascot.alt} height={1254} width={1254} />
              {activeMascot.second && <img className="page-banner-second" src={withBasePath(activeMascot.second)} alt="" height={1254} width={1254} />}
            </div>
          </section>
        )}

        <section className={active === "overview" ? "panel records-panel overview-records" : "panel records-panel"}>
          <div className="panel-head records-head">
            <div><span className="section-kicker">{active === "overview" ? "RECENT NOTES" : "ALL NOTES"}</span><h2>{active === "overview" ? "最近的小账目" : `${activeMeta?.title}记录`}</h2></div>
            {active !== "overview" && <button className="outline-button" onClick={() => openAdd()} type="button">＋ 新增</button>}
          </div>
          {loading ? (
            <div className="empty">正在翻找小纸条…</div>
          ) : visibleEntries.length === 0 ? (
            <div className="empty"><img src={withBasePath(activeMascot?.src ?? "/mascot-cutouts/03-drawing-playful-v2.png")} alt={activeMascot?.alt ?? "小女孩开心画画"} height={1254} loading="lazy" width={1254} /><div><strong>这页还是空空的</strong><span>先写下第一笔，让小账本热闹起来吧！</span><button onClick={() => openAdd()} type="button">马上记一笔 →</button></div></div>
          ) : (
            <div className="table-wrap"><table><thead><tr><th>DATE</th><th>今天发生什么</th><th>分类贴纸</th><th>是谁的</th><th>从哪里来</th><th className="amount">金额</th><th /></tr></thead><tbody>{visibleEntries.map((entry) => <tr key={entry.id}><td>{entry.entryDate}</td><td><strong>{entry.title}</strong>{entry.detail && <small>{entry.detail}</small>}</td><td><span className="tag">{entry.category}</span></td><td>{entry.owner === "family" ? "我们家" : roleNames[entry.owner].name}</td><td><span className={entry.source === "feishu" ? "source imported" : "source"}>{entry.source === "feishu" ? "旧账搬家" : "刚刚手记"}</span></td><td className="amount">{money(entry.amountCents)}</td><td><button aria-label={`删除 ${entry.title}`} className="delete-button" onClick={() => removeEntry(entry.id)} type="button">×</button></td></tr>)}</tbody></table></div>
          )}
        </section>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <section aria-labelledby="entry-form-title" aria-modal="true" className="modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="modal-head"><div><span className="section-kicker">NEW LITTLE NOTE</span><h2 id="entry-form-title">{formMeta.title}</h2><p>{formMeta.description}</p></div><button aria-label="关闭" onClick={() => setModalOpen(false)} type="button">×</button></div>
            <form onSubmit={saveEntry}>
              <input name="kind" type="hidden" value={kindToAdd} />
              <div className="form-grid">
                <Field label="日期"><input defaultValue={today} name="entryDate" required type="date" /></Field>
                {kindToAdd === "abnormal_month" && <Field label="信用卡自然月"><input defaultValue={today.slice(0, 7)} name="month" required type="month" /></Field>}
                <Field label={kindToAdd === "gift" ? "送礼人 / 对象" : "项目"}><input name="title" placeholder={kindToAdd === "income" ? "例如：这个月的工资" : "给这笔小账起个名字"} required /></Field>
                <Field label="金额（元）"><input min="0" name="amount" placeholder="0.00" required step="0.01" type="number" /></Field>
                <Field label="分类"><select name="category">
                  {kindToAdd === "income" && <><option>工资</option><option>额外收入</option></>}
                  {kindToAdd === "large_expense" && <><option>家电</option><option>旅行</option><option>家居</option><option>医疗</option><option>其他</option></>}
                  {kindToAdd === "child_expense" && <><option>教育</option><option>医疗</option><option>兴趣</option><option>日常</option><option>其他</option></>}
                  {kindToAdd === "abnormal_month" && <><option>大额购物</option><option>旅行</option><option>医疗</option><option>临时事项</option><option>其他</option></>}
                  {kindToAdd === "gift" && <><option>节庆</option><option>生日</option><option>婚礼</option><option>探望</option><option>其他</option></>}
                </select></Field>
                {kindToAdd === "gift" && <Field label="形式"><select name="giftType"><option>礼金</option><option>礼物</option><option>礼金＋礼物</option></select></Field>}
                <Field label="备注" wide><textarea name="detail" placeholder="写下原因、场合，或者一句可爱的小备注" rows={3} /></Field>
              </div>
              <div className="form-foot"><span>{kindToAdd === "income" ? `会收进 ${currentRole.name} 的私人小口袋` : "会收进我们的家庭共享账本"}</span><div><button className="cancel-button" onClick={() => setModalOpen(false)} type="button">等等再记</button><button className="primary-button" disabled={saving} type="submit">{saving ? "正在贴进账本…" : "好啦，保存！"}</button></div></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
