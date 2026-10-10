// Staff sessions: a signed, expiring cookie (HMAC-SHA256 via Web Crypto, so the
// same code runs in middleware and in server components). No user table needed:
// staff share ADMIN_PASSWORD and type their own name, which is stamped on every
// action in the lead timeline. Per-person logins are on the roadmap.
export const SESSION_COOKIE = "sc_session";
export const SESSION_HOURS = 12;

export type Staff = { name: string; exp: number };

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

async function sign(data: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSessionToken(name: string): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET (32+ characters) is not configured");
  const payload = b64url(enc.encode(JSON.stringify({ name, exp: Date.now() + SESSION_HOURS * 3600_000 })));
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<Staff | null> {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, await sign(payload, secret))) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Staff;
    if (typeof data.name !== "string" || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

/** Constant-time password check (hash both sides so lengths match). */
export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 8) return false;
  const h = async (s: string) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return safeEqual(await h(input), await h(expected));
}
