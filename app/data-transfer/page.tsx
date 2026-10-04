import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionRoleFromCookieHeader } from "../auth-session";
import { withBasePath } from "../base-path";
import TransferPanel from "./transfer-panel";

export const dynamic = "force-dynamic";

export default async function DataTransferPage() {
  const requestHeaders = await headers();
  if (!await getSessionRoleFromCookieHeader(requestHeaders.get("cookie"))) redirect(withBasePath("/"));
  return <TransferPanel />;
}
