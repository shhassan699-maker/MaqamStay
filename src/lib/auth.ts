import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { allowedOrigin, isCrmHost } from "@/lib/customer-hosts";

const cookieName = "maqamstay_admin";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function getAdmin() {
  if (!isCrmHost((await headers()).get("host"))) return null;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { admin: true },
  });
  if (!session || session.expiresAt < new Date() || !session.admin.active)
    return null;
  return {
    id: session.admin.id,
    name: session.admin.name,
    email: session.admin.email,
  };
}

export async function createSession(adminId: string) {
  if (!isCrmHost((await headers()).get("host")))
    throw new Error("CRM host required");
  const token = randomBytes(32).toString("hex");
  await db.adminSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await db.adminSession.create({
    data: {
      adminId,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
}

export async function deleteSession() {
  if (!isCrmHost((await headers()).get("host")))
    throw new Error("CRM host required");
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token)
    await db.adminSession.deleteMany({ where: { tokenHash: hash(token) } });
  jar.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function validOrigin() {
  const h = await headers();
  try {
    return allowedOrigin(h.get("origin"), h.get("host"), "public");
  } catch {
    return false;
  }
}
export async function validAdminOrigin() {
  const h = await headers();
  try {
    return allowedOrigin(h.get("origin"), h.get("host"), "crm");
  } catch {
    return false;
  }
}
