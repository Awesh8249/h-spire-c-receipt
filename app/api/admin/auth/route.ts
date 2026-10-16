import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { admins, loginSecurity } from "../../../../db/schema";
import { authenticatedAdmin, clearSessionCookie, hashSecret, isHeadAdmin, randomCode, sessionCookie, verifySecret } from "../../../../lib/admin-auth";

const setupAdmins = () =>
  new Set(
    String(env.SETUP_ADMIN_MOBILES || "")
      .split(",")
      .map((value) => value.replace(/\D/g, ""))
      .filter((value) => /^\d{10}$/.test(value)),
  );
const isSetupAdmin = (mobile: string) => setupAdmins().has(mobile);
const validPassword = (value: string) => value.length >= 8 && value.length <= 72 && /[A-Za-z]/.test(value) && /\d/.test(value);
const normalizeCode = (value: unknown) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const json = (body: unknown, status = 200, cookie?: string) => Response.json(body, { status, headers: cookie ? { "Set-Cookie": cookie } : undefined });
const masked = (mobile: string) => `${mobile.slice(0, 2)}XXXXXX${mobile.slice(-2)}`;

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action || "login");
  const mobile = String(body.mobile || "").replace(/\D/g, "");
  const password = String(body.password || body.pin || "");
  const db = getDb();

  if (action === "logout") return json({ success: true }, 200, clearSessionCookie());
  if (action === "adminList") {
    const current = await authenticatedAdmin(request);
    if (!current || !isHeadAdmin(current.mobile)) return json({ error: "This control is not available for this administrator." }, 403);
    const rows = await db.select().from(admins);
    return json({
      success: true,
      admins: rows.map((item) => ({ mobile: item.mobile, maskedMobile: masked(item.mobile), active: item.active, createdAt: item.createdAt, lastLoginAt: item.lastLoginAt, isCurrent: item.mobile === current.mobile })),
      activeRecently: rows.filter((item) => item.active && item.lastLoginAt > Date.now() - 30 * 60 * 1000).length,
    });
  }
  if (!/^\d{10}$/.test(mobile)) return json({ error: "Enter a valid 10-digit mobile number." }, 400);

  if (action === "removeAdmin" || action === "resetAdmin" || action === "setAdminPassword") {
    const current = await authenticatedAdmin(request);
    if (!current || !isHeadAdmin(current.mobile)) return json({ error: "This control is not available for this administrator." }, 403);
    if (isHeadAdmin(mobile)) return json({ error: "The main administrator cannot be removed or reset from this list." }, 400);
    const [target] = await db.select().from(admins).where(eq(admins.mobile, mobile)).limit(1);
    if (!target) return json({ error: "Administrator not found." }, 404);
    if (action === "removeAdmin") {
      await db.update(admins).set({ active: false }).where(eq(admins.mobile, mobile));
      return json({ success: true });
    }
    if (action === "setAdminPassword") {
      const newPassword = String(body.newPassword || "");
      if (!validPassword(newPassword)) return json({ error: "Use at least 8 characters with both letters and numbers." }, 400);
      const passwordData = await hashSecret(newPassword);
      await db.update(admins).set({ pinHash: passwordData.hash, pinSalt: passwordData.salt, active: true }).where(eq(admins.mobile, mobile));
      await db.delete(loginSecurity).where(eq(loginSecurity.mobile, mobile));
      return json({ success: true });
    }
    const resetCode = randomCode(14), recovery = await hashSecret(resetCode);
    await db.update(admins).set({ recoveryHash: recovery.hash, recoverySalt: recovery.salt }).where(eq(admins.mobile, mobile));
    return json({ success: true, resetCode });
  }

  if (action === "setup") {
    if (!isSetupAdmin(mobile)) return json({ error: "This mobile must receive an invitation before creating a password." }, 403);
    const bootstrapCode = normalizeCode(env.ADMIN_BOOTSTRAP_CODE);
    if (!bootstrapCode) return json({ error: "Administrator setup is temporarily unavailable." }, 503);
    if (normalizeCode(body.setupCode) !== bootstrapCode) return json({ error: "The one-time setup code is incorrect." }, 403);
    if (!validPassword(password)) return json({ error: "Use at least 8 characters with both letters and numbers." }, 400);
    const [existing] = await db.select().from(admins).where(eq(admins.mobile, mobile)).limit(1);
    if (existing?.pinHash) return json({ error: "A password already exists for this mobile. Use Login or Forgot Password." }, 409);
    const headRecoveryCode = String(env.HEAD_ADMIN_RECOVERY_CODE || "");
    if (isHeadAdmin(mobile) && !normalizeCode(headRecoveryCode)) return json({ error: "Head-administrator recovery is not configured." }, 503);
    const recoveryCode = isHeadAdmin(mobile) ? headRecoveryCode : randomCode(14);
    const passwordData = await hashSecret(password), recovery = await hashSecret(recoveryCode);
    const role = isHeadAdmin(mobile) ? "head" : "admin";
    await db.insert(admins).values({ mobile, role, pinHash: passwordData.hash, pinSalt: passwordData.salt, recoveryHash: recovery.hash, recoverySalt: recovery.salt, active: true, lastLoginAt: Date.now() }).onConflictDoUpdate({ target: admins.mobile, set: { pinHash: passwordData.hash, pinSalt: passwordData.salt, recoveryHash: recovery.hash, recoverySalt: recovery.salt, role, active: true, lastLoginAt: Date.now() } });
    return json({ success: true, recoveryCode, role }, 200, await sessionCookie(mobile));
  }

  if (action === "recover") {
    const nextPassword = String(body.newPassword || body.newPin || "");
    if (!validPassword(nextPassword)) return json({ error: "Use at least 8 characters with both letters and numbers." }, 400);
    const [admin] = await db.select().from(admins).where(eq(admins.mobile, mobile)).limit(1);
    const enteredRecovery = normalizeCode(body.recoveryCode);
    const configuredHeadRecovery = normalizeCode(env.HEAD_ADMIN_RECOVERY_CODE);
    const headRecovery = isHeadAdmin(mobile) && !!configuredHeadRecovery && enteredRecovery === configuredHeadRecovery;
    if (!admin || (!headRecovery && !(await verifySecret(enteredRecovery, admin.recoveryHash, admin.recoverySalt)))) return json({ error: "The recovery or reset code is incorrect." }, 403);
    const recoveryCode = isHeadAdmin(mobile) ? String(env.HEAD_ADMIN_RECOVERY_CODE || "") : randomCode(14);
    const passwordData = await hashSecret(nextPassword), recovery = await hashSecret(recoveryCode);
    await db.update(admins).set({ pinHash: passwordData.hash, pinSalt: passwordData.salt, recoveryHash: recovery.hash, recoverySalt: recovery.salt, active: true, lastLoginAt: Date.now() }).where(eq(admins.mobile, mobile));
    await db.delete(loginSecurity).where(eq(loginSecurity.mobile, mobile));
    return json({ success: true, recoveryCode, role: admin.role }, 200, await sessionCookie(mobile));
  }

  if (action === "acceptInvite") {
    if (!validPassword(password)) return json({ error: "Use at least 8 characters with both letters and numbers." }, 400);
    const [admin] = await db.select().from(admins).where(and(eq(admins.mobile, mobile), eq(admins.active, true))).limit(1);
    if (!admin || !admin.inviteExpiresAt || admin.inviteExpiresAt < Date.now() || !(await verifySecret(normalizeCode(body.inviteCode), admin.inviteHash, admin.recoverySalt))) return json({ error: "The invitation is invalid or expired." }, 403);
    const passwordData = await hashSecret(password), recoveryCode = randomCode(14), recovery = await hashSecret(recoveryCode);
    await db.update(admins).set({ pinHash: passwordData.hash, pinSalt: passwordData.salt, recoveryHash: recovery.hash, recoverySalt: recovery.salt, inviteHash: null, inviteExpiresAt: null, lastLoginAt: Date.now() }).where(eq(admins.mobile, mobile));
    return json({ success: true, recoveryCode, role: admin.role }, 200, await sessionCookie(mobile));
  }

  if (action === "invite") {
    const current = await authenticatedAdmin(request);
    if (!current || !isHeadAdmin(current.mobile)) return json({ error: "This control is not available for this administrator." }, 403);
    if (isHeadAdmin(mobile)) return json({ error: "This mobile is already protected as the main administrator." }, 400);
    const inviteCode = randomCode(10), invite = await hashSecret(inviteCode);
    await db.insert(admins).values({ mobile, role: "admin", recoverySalt: invite.salt, inviteHash: invite.hash, inviteExpiresAt: Date.now() + 24 * 60 * 60 * 1000, active: true }).onConflictDoUpdate({ target: admins.mobile, set: { role: "admin", pinHash: null, pinSalt: null, inviteHash: invite.hash, recoverySalt: invite.salt, inviteExpiresAt: Date.now() + 24 * 60 * 60 * 1000, active: true } });
    return json({ success: true, inviteCode, expiresIn: "24 hours" });
  }

  const [security] = await db.select().from(loginSecurity).where(eq(loginSecurity.mobile, mobile)).limit(1);
  if (security?.lockedUntil && security.lockedUntil > Date.now()) return json({ error: `Too many incorrect attempts. Try again in ${Math.ceil((security.lockedUntil - Date.now()) / 60000)} minute(s).`, locked: true }, 429);
  const [admin] = await db.select().from(admins).where(and(eq(admins.mobile, mobile), eq(admins.active, true))).limit(1);
  if (!admin?.pinHash) return json({ error: isSetupAdmin(mobile) ? "Password not created yet. Choose First-time setup." : "This administrator must accept an invitation first." }, 403);
  if (!(await verifySecret(password, admin.pinHash, admin.pinSalt))) {
    const failed = (security?.failedAttempts || 0) + 1;
    if (failed >= 3) {
      const level = Math.min((security?.lockLevel || 0) + 1, 3), minutes = level === 1 ? 5 : level === 2 ? 15 : 30;
      await db.insert(loginSecurity).values({ mobile, failedAttempts: 0, lockLevel: level, lockedUntil: Date.now() + minutes * 60000 }).onConflictDoUpdate({ target: loginSecurity.mobile, set: { failedAttempts: 0, lockLevel: level, lockedUntil: Date.now() + minutes * 60000 } });
      return json({ error: `Three incorrect attempts. Access is locked for ${minutes} minutes.`, locked: true }, 429);
    }
    await db.insert(loginSecurity).values({ mobile, failedAttempts: failed, lockLevel: security?.lockLevel || 0, lockedUntil: 0 }).onConflictDoUpdate({ target: loginSecurity.mobile, set: { failedAttempts: failed, lockedUntil: 0 } });
    return json({ error: `Incorrect password. ${3 - failed} attempt(s) remaining.` }, 403);
  }
  await db.delete(loginSecurity).where(eq(loginSecurity.mobile, mobile));
  const role = isHeadAdmin(mobile) ? "head" : admin.role;
  await db.update(admins).set({ lastLoginAt: Date.now(), role }).where(eq(admins.mobile, mobile));
  return json({ success: true, role }, 200, await sessionCookie(mobile));
}
