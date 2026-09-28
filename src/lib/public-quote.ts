import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { publicQuoteSelect } from "@/lib/public-quote-select";
export async function getPublicQuote(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const quote=await db.quote.findUnique({where:{tokenHash:createHash("sha256").update(token).digest("hex")},select:publicQuoteSelect});
  if(!quote||quote.request.status==="CANCELLED"||(quote.expiresAt&&quote.expiresAt<new Date()))return null;
  return quote;
}
