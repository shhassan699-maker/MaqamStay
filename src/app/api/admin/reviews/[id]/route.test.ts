import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/http", () => ({ adminWriteGuard: mocks.guard, failure: (error: unknown) => { throw error; } }));
vi.mock("@/lib/db", () => ({ db: { review: { findUnique: mocks.find, update: mocks.update } } }));

import { PATCH } from "./route";

const id = "00000000-0000-4000-8000-000000000112";
const request = (body: object) => new Request("http://localhost/api/admin/reviews/" + id, { method: "PATCH", body: JSON.stringify(body) });

describe("admin review moderation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue(null);
    mocks.find.mockResolvedValue({ id, publishedAt: new Date("2026-01-01"), booking: { status: "CONFIRMED", reference: "BK-2026-REAL001" } });
    mocks.update.mockResolvedValue({ id });
  });

  it("does not write without admin authorization", async () => {
    mocks.guard.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await PATCH(request({ published: false }), { params: Promise.resolve({ id }) })).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("unpublishes a review without deleting the record", async () => {
    const response = await PATCH(request({ published: false }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id }, data: expect.objectContaining({ publishedAt: null }) });
  });

  it("rejects publication if the booking was cancelled", async () => {
    mocks.find.mockResolvedValue({ id, publishedAt: null, booking: { status: "CANCELLED", reference: "BK-2026-REAL001" } });
    expect((await PATCH(request({ published: true }), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
