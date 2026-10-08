import { NextResponse } from "next/server";
import { deleteSession, validAdminOrigin as validOrigin } from "@/lib/auth";
export async function POST() {
  if (!(await validOrigin()))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  await deleteSession();
  return NextResponse.json({ ok: true });
}
