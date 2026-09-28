import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { review: { findMany } } }));

import { getPublishedReviews } from "./published-reviews";
import { toPublicReview } from "./public-reviews";

describe("public reviews", () => {
  const oldUrl = process.env.DATABASE_URL;
  beforeEach(() => { vi.resetAllMocks(); process.env.DATABASE_URL = "postgresql://test"; });
  afterEach(() => { if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl; });

  it("only queries published reviews attached to confirmed stays", async () => {
    findMany.mockResolvedValue([]);
    await getPublishedReviews();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        publishedAt: { not: null },
        booking: { status: { in: ["CONFIRMED", "COMPLETED"] }, reference: { not: { startsWith: "BK-2026-DEMO" } } },
      },
    }));
    expect(JSON.stringify(findMany.mock.calls[0][0].select)).not.toMatch(/supplier|price|commission|whatsapp|customer|createdBy|consent/);
  });

  it("returns only customer-facing fields", () => {
    const internal = {
      id: "review-id",
      displayName: "Ayesha K.",
      rating: 5,
      body: "The room suited our family very well.",
      booking: { option: { destination: "MAKKAH" as const, supplierPrice: "2000" }, customer: { whatsapp: "+923001234567" } },
      createdById: "admin-id",
      consentConfirmedAt: new Date(),
    };
    const result = toPublicReview(internal);
    expect(result).toEqual({ id: "review-id", displayName: "Ayesha K.", rating: 5, body: "The room suited our family very well.", destination: "MAKKAH" });
    expect(JSON.stringify(result)).not.toMatch(/supplierPrice|whatsapp|createdBy|consent/);
  });
});
