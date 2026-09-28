import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAdmin, validOrigin } from "@/lib/auth";

export function failure(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation failed", fields: error.flatten().fieldErrors }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({error:"Malformed JSON"},{status:400});
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
export async function adminWriteGuard() {
  if (!await getAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await validOrigin()) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  return null;
}
export async function publicWriteGuard() { return await validOrigin() ? null : NextResponse.json({ error: "Invalid origin" }, { status: 403 }); }
