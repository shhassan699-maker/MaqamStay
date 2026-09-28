import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminWriteGuard, failure } from "@/lib/http";
import { reviewUpdateSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminWriteGuard();
  if (guard) return guard;

  try {
    const id = z.uuid().parse((await params).id);
    const data = reviewUpdateSchema.parse(await request.json());
    const existing = await db.review.findUnique({
      where: { id },
      select: { id: true, publishedAt: true, booking: { select: { status: true, reference: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    if (data.published && (existing.booking.reference.startsWith("BK-2026-DEMO") || !["CONFIRMED", "COMPLETED"].includes(existing.booking.status))) {
      return NextResponse.json({ error: "Only reviews for confirmed or completed bookings can be published." }, { status: 400 });
    }
    await db.review.update({
      where: { id },
      data: {
        displayName: data.displayName,
        rating: data.rating,
        body: data.body,
        publishedAt: data.published === undefined ? undefined : data.published ? existing.publishedAt ?? new Date() : null,
      },
    });
    return NextResponse.json({ id });
  } catch (error) {
    return failure(error);
  }
}
