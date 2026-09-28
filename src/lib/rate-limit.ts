import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export async function rateLimited(scope: string, limit = 8, minutes = 60) {
  const h = await headers(); const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const key = createHmac("sha256", env().SESSION_SECRET).update(`${scope}:${ip}`).digest("hex");
  const cutoff = new Date(Date.now() - minutes * 60000);
  const row = await db.rateLimit.upsert({ where: { key }, create: { key, count: 1, windowStart: new Date() }, update: { count: { increment: 1 } } });
  if (row.windowStart < cutoff) { await db.rateLimit.update({ where: { key }, data: { count: 1, windowStart: new Date() } }); return false; }
  return row.count > limit;
}
