import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const cookieName = "maqamstay_admin";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function getAdmin() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.adminSession.findUnique({ where: { tokenHash: hash(token) }, include: { admin: true } });
  if (!session || session.expiresAt < new Date() || !session.admin.active) return null;
  return { id: session.admin.id, name: session.admin.name, email: session.admin.email };
}

export async function createSession(adminId: string) {
  const token = randomBytes(32).toString("hex");
  await db.adminSession.deleteMany({where:{expiresAt:{lt:new Date()}}});
  await db.adminSession.create({ data: { adminId, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) } });
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}

export async function deleteSession() {
  const jar = await cookies(); const token = jar.get(cookieName)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete(cookieName);
}

export async function validOrigin() {
  const h = await headers(); const origin = h.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === new URL(env().NEXT_PUBLIC_SITE_URL).host || new URL(origin).host === h.get("host"); } catch { return false; }
}
