import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { adminWriteGuard, failure } from "@/lib/http";
import { reviewSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const guard = await adminWriteGuard();
  if (guard) return guard;

  try {
    const admin = await getAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const data = reviewSchema.parse(await request.json());
    const booking = await db.booking.findUnique({
      where: { id: data.bookingId },
      select: { status: true, reference: true, review: { select: { id: true } } },
    });
    if (!booking || booking.reference.startsWith("BK-2026-DEMO") || !["CONFIRMED", "COMPLETED"].includes(booking.status)) {
      return NextResponse.json({ error: "Choose a confirmed or completed booking." }, { status: 400 });
    }
    if (booking.review) return NextResponse.json({ error: "This booking already has a review." }, { status: 409 });

    const review = await db.review.create({
      data: {
        bookingId: data.bookingId,
        createdById: admin.id,
        displayName: data.displayName,
        rating: data.rating,
        body: data.body,
        consentConfirmedAt: new Date(),
        publishedAt: data.published ? new Date() : null,
      },
      select: { id: true },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This booking already has a review." }, { status: 409 });
    }
    return failure(error);
  }
}
