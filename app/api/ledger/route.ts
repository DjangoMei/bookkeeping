import { and, desc, eq, or } from "drizzle-orm";
import { ensureLedgerSchema, getDb } from "../../../db";
import { ledgerEntries } from "../../../db/schema";
import { getSessionRole } from "../../auth-session";

type EntryKind =
  | "income"
  | "large_expense"
  | "child_expense"
  | "abnormal_month"
  | "gift";

const VALID_KINDS = new Set<EntryKind>([
  "income",
  "large_expense",
  "child_expense",
  "abnormal_month",
  "gift",
]);

function centsFromUnknown(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return Number.NaN;
  return Math.round(amount * 100);
}

function cleanText(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET(request: Request) {
  const role = await getSessionRole(request);
  if (!role) {
    return Response.json({ error: "当前账号尚未关联 zcy 或 Django" }, { status: 403 });
  }

  try {
    await ensureLedgerSchema();
    const db = getDb();
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(
        or(
          eq(ledgerEntries.owner, "family"),
          eq(ledgerEntries.owner, role),
        ),
      )
      .orderBy(desc(ledgerEntries.entryDate), desc(ledgerEntries.id));

    return Response.json({ entries, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取账本失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const role = await getSessionRole(request);
  if (!role) {
    return Response.json({ error: "当前账号没有记账权限" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const kind = cleanText(payload.kind) as EntryKind;
    const entryDate = cleanText(payload.entryDate, 10);
    const title = cleanText(payload.title, 80);
    const amountCents = centsFromUnknown(payload.amount);

    if (
      !VALID_KINDS.has(kind) ||
      !entryDate ||
      !title ||
      !Number.isFinite(amountCents) ||
      (amountCents < 0 && kind !== "large_expense")
    ) {
      return Response.json({ error: "请完整填写日期、项目和金额" }, { status: 400 });
    }

    const owner = kind === "income" ? role : "family";
    const month =
      kind === "abnormal_month"
        ? cleanText(payload.month, 7) || entryDate.slice(0, 7)
        : null;

    await ensureLedgerSchema();
    const db = getDb();
    const [entry] = await db
      .insert(ledgerEntries)
      .values({
        kind,
        owner,
        entryDate,
        month,
        title,
        category: cleanText(payload.category, 40) || "其他",
        amountCents,
        detail: cleanText(payload.detail, 500),
        giftType: kind === "gift" ? cleanText(payload.giftType, 20) || "礼金" : null,
        source: "manual",
        createdByRole: role,
      })
      .returning();

    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const role = await getSessionRole(request);
  if (!role) {
    return Response.json({ error: "当前账号没有删除权限" }, { status: 403 });
  }

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "无效的记录" }, { status: 400 });
  }

  try {
    await ensureLedgerSchema();
    const db = getDb();
    await db
      .delete(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.id, id),
          or(
            eq(ledgerEntries.owner, role),
            eq(ledgerEntries.owner, "family"),
          ),
        ),
      );
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
