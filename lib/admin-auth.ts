import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { admins } from "../db/schema";

const encoder = new TextEncoder();
const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const hexToBytes = (hex: string) =>
  new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
export const randomCode = (length = 12) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};
export async function hashSecret(secret: string, saltHex?: string) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"]);
  // Cloudflare Workers currently accepts at most 100,000 PBKDF2 iterations.
  // Using the platform maximum keeps PIN hashing strong without throwing at runtime.
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}
export async function verifySecret(secret: string, hash: string | null, salt: string | null) {
  if (!hash || !salt) return false;
  return (await hashSecret(secret, salt)).hash === hash;
}
async function sign(payload: string) {
  const sessionSecret = String(env.ADMIN_SESSION_SECRET || "");
  if (sessionSecret.length < 32) throw new Error("Admin authentication is not configured securely.");
  const key = await crypto.subtle.importKey("raw", encoder.encode(sessionSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}
export async function sessionCookie(mobile: string) {
  const payload = `${mobile}.${Date.now() + 30 * 60 * 1000}`;
  return `hsc_admin=${payload}.${await sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`;
}
export const isHeadAdmin = (mobile: string) =>
  mobile === String(env.HEAD_ADMIN_MOBILE || "").replace(/\D/g, "");
export const clearSessionCookie = () => "hsc_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
export async function authenticatedAdmin(request: Request) {
  const value = request.headers.get("cookie")?.match(/(?:^|; )hsc_admin=([^;]+)/)?.[1];
  if (!value) return null;
  const [mobile, expiry, signature] = value.split(".");
  const payload = `${mobile}.${expiry}`;
  if (!/^\d{10}$/.test(mobile) || Number(expiry) < Date.now() || signature !== (await sign(payload))) return null;
  const [admin] = await getDb().select().from(admins).where(eq(admins.mobile, mobile)).limit(1);
  return admin?.active && admin.pinHash ? admin : null;
}
