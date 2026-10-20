import { getSessionRole, passphraseMatches } from "../../auth-session";
import { digest, hasTransferAccess, isSameOrigin, seal, sessionBinding, transferCookie, unseal } from "../../transfer-auth";
import { applyMerge, planMerge, readSnapshot, summarize, validateSnapshot } from "../../../db/data-transfer";

const headers = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };
function reply(data: unknown, status = 200, extra = {}) { return Response.json(data, { status, headers: { ...headers, ...extra } }); }
async function bodyJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json") || !request.body) throw new Error("请使用 JSON 请求。");
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let size = 0, body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error("备份超过 2 MB，请使用数据库级迁移。"); }
    body += decoder.decode(value, { stream: true });
  }
  return JSON.parse(body + decoder.decode());
}

export async function GET(request: Request) {
  return reply({ unlocked: await hasTransferAccess(request) });
}

export async function POST(request: Request) {
  try {
    // Drain the bounded body even for denied requests; Wrangler's local proxy
    // can otherwise cancel the next request on a reused connection.
    const body = await bodyJson(request);
    if (!isSameOrigin(request)) return reply({ error: "仅允许从当前网站执行管理操作。" }, 403);
    if (!await getSessionRole(request)) return reply({ error: "请先登录账本。" }, 401);
    if (body.action === "unlock") {
      if (typeof body.passphrase !== "string" || body.passphrase.length > 512 || !await passphraseMatches(body.passphrase)) return reply({ error: "口令不正确。" }, 403);
      return reply({ unlocked: true }, 200, { "Set-Cookie": await transferCookie(request) });
    }
    if (!await hasTransferAccess(request)) return reply({ error: "管理授权已过期，请再次输入口令。" }, 403);
    const host = new URL(request.url).host;
    const target = await readSnapshot(host);
    if (body.action === "backup") return reply({ backup: target.snapshot, backupHash: target.hash, summary: summarize(target.snapshot) });
    if (body.action !== "preview" && body.action !== "apply") return reply({ error: "未知操作。" }, 400);
    const source = validateSnapshot(body.snapshot);
    const sourceHash = await digest(JSON.stringify(source.tables));
    const plan = planMerge(source, target.snapshot, target.sequences);
    if (body.action === "preview") {
      const token = await seal({ purpose: "transfer-plan-v1", host, session: await sessionBinding(request), sourceHash, targetHash: target.hash });
      return reply({ backup: target.snapshot, backupHash: target.hash, token, plan, sourceSummary: summarize(source), targetSummary: summarize(target.snapshot) });
    }
    const claims = typeof body.token === "string" ? await unseal(body.token) : null;
    if (claims?.purpose !== "transfer-plan-v1" || claims.host !== host || claims.session !== await sessionBinding(request) || claims.sourceHash !== sourceHash || claims.targetHash !== target.hash || body.backupHash !== target.hash || body.confirm !== "合并缺失数据") {
      return reply({ error: "备份或数据库已变化，或预览已过期；请重新预览并保存备份。" }, 409);
    }
    if (plan.conflicts.length) return reply({ error: "有内容冲突，未修改任何账目。请先核对差异。", plan }, 409);
    await applyMerge(target, plan);
    const after = await readSnapshot(host);
    const verification = planMerge(source, after.snapshot, after.sequences);
    return reply({ merged: true, counts: plan.counts, backup: after.snapshot, summary: summarize(after.snapshot), verified: !verification.operations.length && !verification.conflicts.length });
  } catch {
    // No payloads, credentials, SQL, or private rows are logged or leaked in errors.
    return reply({ error: "操作未完成。请检查备份格式并重新预览；如提交结果不确定，先下载备份核对，勿重复提交。" }, 400);
  }
}
