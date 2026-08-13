import { and, desc, eq } from "drizzle-orm";
import { ensureFamilyFinanceSchema, getDb } from "../../../db";
import { familyProjects, projectExpenses, savingsAccounts } from "../../../db/schema";
import { getSessionRole } from "../../auth-session";

type Entity = "saving" | "project" | "expense";

function text(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function cents(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

export async function GET(request: Request) {
  const role = await getSessionRole(request);
  if (!role) return Response.json({ error: "请先登录" }, { status: 403 });
  try {
    await ensureFamilyFinanceSchema();
    const db = getDb();
    const [savings, projects, expenses] = await Promise.all([
      db.select().from(savingsAccounts).orderBy(desc(savingsAccounts.updatedAt), desc(savingsAccounts.id)),
      db.select().from(familyProjects).orderBy(desc(familyProjects.updatedAt), desc(familyProjects.id)),
      db.select().from(projectExpenses).orderBy(desc(projectExpenses.expenseDate), desc(projectExpenses.id)),
    ]);
    return Response.json({ savings, projects, expenses });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取家庭资产失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const role = await getSessionRole(request);
  if (!role) return Response.json({ error: "请先登录" }, { status: 403 });
  try {
    await ensureFamilyFinanceSchema();
    const db = getDb();
    const body = await request.json() as Record<string, unknown>;
    const entity = text(body.entity) as Entity;
    if (entity === "saving") {
      const name = text(body.name, 80), balanceCents = cents(body.balance);
      if (!name || !Number.isFinite(balanceCents) || balanceCents < 0) return Response.json({ error: "请填写账户和有效余额" }, { status: 400 });
      const [item] = await db.insert(savingsAccounts).values({ name, category: text(body.category, 30) || "其他", balanceCents, detail: text(body.detail, 500), updatedByRole: role }).returning();
      return Response.json({ item }, { status: 201 });
    }
    if (entity === "project") {
      const name = text(body.name, 80), budgetCents = cents(body.budget);
      if (!name || !Number.isFinite(budgetCents) || budgetCents < 0) return Response.json({ error: "请填写项目名称和有效预算" }, { status: 400 });
      const [item] = await db.insert(familyProjects).values({ name, budgetCents, status: text(body.status, 20) || "进行中", detail: text(body.detail, 500), updatedByRole: role }).returning();
      return Response.json({ item }, { status: 201 });
    }
    if (entity === "expense") {
      const projectId = Number(body.projectId), title = text(body.title, 80), amountCents = cents(body.amount), expenseDate = text(body.expenseDate, 10);
      if (!Number.isInteger(projectId) || projectId <= 0 || !title || !expenseDate || !Number.isFinite(amountCents) || amountCents < 0) return Response.json({ error: "请完整填写专项支出" }, { status: 400 });
      const [project] = await db.select({ id: familyProjects.id }).from(familyProjects).where(eq(familyProjects.id, projectId)).limit(1);
      if (!project) return Response.json({ error: "专项不存在" }, { status: 404 });
      const [item] = await db.insert(projectExpenses).values({ projectId, expenseDate, title, category: text(body.category, 30) || "其他", amountCents, detail: text(body.detail, 500), updatedByRole: role }).returning();
      return Response.json({ item }, { status: 201 });
    }
    return Response.json({ error: "不支持的记录类型" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const role = await getSessionRole(request);
  if (!role) return Response.json({ error: "请先登录" }, { status: 403 });
  const url = new URL(request.url), id = Number(url.searchParams.get("id")), entity = url.searchParams.get("entity") as Entity;
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "无效记录" }, { status: 400 });
  try {
    await ensureFamilyFinanceSchema();
    const db = getDb(), body = await request.json() as Record<string, unknown>, updatedAt = new Date().toISOString();
    if (entity === "saving") {
      const name = text(body.name, 80), balanceCents = cents(body.balance);
      if (!name || !Number.isFinite(balanceCents) || balanceCents < 0) return Response.json({ error: "请填写账户和有效余额" }, { status: 400 });
      const [item] = await db.update(savingsAccounts).set({ name, category: text(body.category, 30) || "其他", balanceCents, detail: text(body.detail, 500), updatedByRole: role, updatedAt }).where(eq(savingsAccounts.id, id)).returning();
      return item ? Response.json({ item }) : Response.json({ error: "账户不存在" }, { status: 404 });
    }
    if (entity === "project") {
      const name = text(body.name, 80), budgetCents = cents(body.budget);
      if (!name || !Number.isFinite(budgetCents) || budgetCents < 0) return Response.json({ error: "请填写项目名称和有效预算" }, { status: 400 });
      const [item] = await db.update(familyProjects).set({ name, budgetCents, status: text(body.status, 20) || "进行中", detail: text(body.detail, 500), updatedByRole: role, updatedAt }).where(eq(familyProjects.id, id)).returning();
      return item ? Response.json({ item }) : Response.json({ error: "项目不存在" }, { status: 404 });
    }
    if (entity === "expense") {
      const projectId = Number(body.projectId), title = text(body.title, 80), amountCents = cents(body.amount), expenseDate = text(body.expenseDate, 10);
      if (!Number.isInteger(projectId) || !title || !expenseDate || !Number.isFinite(amountCents) || amountCents < 0) return Response.json({ error: "请完整填写专项支出" }, { status: 400 });
      const [item] = await db.update(projectExpenses).set({ projectId, expenseDate, title, category: text(body.category, 30) || "其他", amountCents, detail: text(body.detail, 500), updatedByRole: role, updatedAt }).where(and(eq(projectExpenses.id, id))).returning();
      return item ? Response.json({ item }) : Response.json({ error: "支出不存在" }, { status: 404 });
    }
    return Response.json({ error: "不支持的记录类型" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "修改失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const role = await getSessionRole(request);
  if (!role) return Response.json({ error: "请先登录" }, { status: 403 });
  const url = new URL(request.url), id = Number(url.searchParams.get("id")), entity = url.searchParams.get("entity") as Entity;
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "无效记录" }, { status: 400 });
  try {
    await ensureFamilyFinanceSchema();
    const db = getDb();
    if (entity === "saving") await db.delete(savingsAccounts).where(eq(savingsAccounts.id, id));
    else if (entity === "expense") await db.delete(projectExpenses).where(eq(projectExpenses.id, id));
    else if (entity === "project") {
      await db.delete(projectExpenses).where(eq(projectExpenses.projectId, id));
      await db.delete(familyProjects).where(eq(familyProjects.id, id));
    } else return Response.json({ error: "不支持的记录类型" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 500 });
  }
}
