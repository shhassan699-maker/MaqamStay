import "server-only";
import { db } from "@/lib/db";
import { toPublicReview } from "@/lib/public-reviews";

export async function getPublishedReviews() {
  if (!process.env.DATABASE_URL) return [];

  try {
    const reviews = await db.review.findMany({
      where: {
        publishedAt: { not: null },
        booking: { status: { in: ["CONFIRMED", "COMPLETED"] }, reference: { not: { startsWith: "BK-2026-DEMO" } } },
      },
      select: {
        id: true,
        displayName: true,
        rating: true,
        body: true,
        booking: { select: { option: { select: { destination: true } } } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
    });
    return reviews.map(toPublicReview);
  } catch (error) {
    console.error("Could not load published reviews", error);
    return [];
  }
}
