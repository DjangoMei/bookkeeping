import { env } from "cloudflare:workers";
import { BASE_PATH } from "./base-path";
import { getSessionRole } from "./auth-session";

const ACCESS_COOKIE = "family_ledger_transfer";
const TTL = 15 * 60;

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
}
async function key() {
  if (!env.SESSION_SECRET) throw new Error("Session secret is unavailable");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function digest(value: string) {
  return encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
export async function seal(claims: Record<string, unknown>) {
  const payload = encode(new TextEncoder().encode(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + TTL })));
  return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(payload))))}`;
}
export async function unseal(token: string): Promise<Record<string, unknown> | null> {
  try {
    if (token.length > 4096) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !await crypto.subtle.verify("HMAC", await key(), decode(signature), new TextEncoder().encode(payload))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    return Number.isSafeInteger(claims.exp) && claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch { return null; }
}
function cookie(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "").split(";").map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
export function sessionBinding(request: Request) {
  return digest(cookie(request, "family_ledger_session"));
}
export async function transferCookie(request: Request) {
  const value = await seal({ purpose: "transfer-access-v1", session: await sessionBinding(request) });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ACCESS_COOKIE}=${value}; Path=${BASE_PATH}/api/data-transfer; Max-Age=${TTL}; HttpOnly; SameSite=Strict${secure}`;
}
export async function hasTransferAccess(request: Request) {
  if (!await getSessionRole(request)) return false;
  const claims = await unseal(cookie(request, ACCESS_COOKIE));
  return claims?.purpose === "transfer-access-v1" && claims.session === await sessionBinding(request);
}
export function isSameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const target = new URL(request.url);
    // The Mac tunnel terminates HTTPS before forwarding HTTP to the Worker.
    return request.headers.get("sec-fetch-site") !== "cross-site" && origin.host === target.host && (origin.protocol === "https:" || origin.origin === target.origin);
  } catch { return false; }
}
