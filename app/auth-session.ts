import { env } from "cloudflare:workers";
import { BASE_PATH } from "./base-path";

export type LedgerRole = "zcy" | "django";

const COOKIE_NAME = "family_ledger_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signature(payload: string) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return base64Url(new Uint8Array(signed));
}

function cookieValue(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const pair = raw
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE_NAME}=`));
  return pair ? decodeURIComponent(pair.slice(COOKIE_NAME.length + 1)) : null;
}

export async function createSessionCookie(role: LedgerRole) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${role}.${expires}`;
  const value = `${payload}.${await signature(payload)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=${BASE_PATH}; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=${BASE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export async function getSessionRole(request: Request): Promise<LedgerRole | null> {
  const value = cookieValue(request);
  if (!value) return null;

  const [role, expiresText, suppliedSignature] = value.split(".");
  if (
    (role !== "zcy" && role !== "django") ||
    !expiresText ||
    !suppliedSignature ||
    Number(expiresText) <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  const expectedSignature = await signature(`${role}.${expiresText}`);
  if (expectedSignature.length !== suppliedSignature.length) return null;

  let mismatch = 0;
  for (let index = 0; index < expectedSignature.length; index += 1) {
    mismatch |= expectedSignature.charCodeAt(index) ^ suppliedSignature.charCodeAt(index);
  }
  return mismatch === 0 ? role : null;
}

export function passphraseMatches(candidate: string) {
  const expected = env.LEDGER_PASSPHRASE;
  if (!expected || candidate.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ candidate.charCodeAt(index);
  }
  return mismatch === 0;
}
