import type { Metadata } from "next";
import { headers } from "next/headers";
import { getSessionRoleFromCookieHeader } from "./auth-session";
import LedgerApp from "./ledger-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cola · 可乐小宝的小账本",
  description: "为可乐——我们爱叫的小宝——收藏生活、记录每一笔的小小家庭账本。",
};

export default async function Home() {
  const requestHeaders = await headers();
  const initialRole = await getSessionRoleFromCookieHeader(
    requestHeaders.get("cookie"),
  );

  return <LedgerApp initialRole={initialRole} />;
}
