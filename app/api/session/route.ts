import {
  clearSessionCookie,
  createSessionCookie,
  getSessionRole,
  passphraseMatches,
  type LedgerRole,
} from "../../auth-session";

export async function GET(request: Request) {
  try {
    const role = await getSessionRole(request);
    return role
      ? Response.json({ role })
      : Response.json({ error: "尚未登录" }, { status: 401 });
  } catch {
    return Response.json({ error: "登录服务尚未配置" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      role?: LedgerRole;
      passphrase?: string;
    };
    const role = payload.role;

    if (
      (role !== "zcy" && role !== "django") ||
      !passphraseMatches(payload.passphrase ?? "")
    ) {
      return Response.json({ error: "用户或口令不正确" }, { status: 401 });
    }

    return Response.json(
      { role },
      { headers: { "set-cookie": await createSessionCookie(role) } },
    );
  } catch {
    return Response.json({ error: "暂时无法登录，请稍后再试" }, { status: 500 });
  }
}

export async function DELETE() {
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": clearSessionCookie() } },
  );
}
