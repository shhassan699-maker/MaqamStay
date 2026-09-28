import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), admin: vi.fn(), booking: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/http", () => ({ adminWriteGuard: mocks.guard, failure: (error: unknown) => { throw error; } }));
vi.mock("@/lib/auth", () => ({ getAdmin: mocks.admin }));
vi.mock("@/lib/db", () => ({ db: { booking: { findUnique: mocks.booking }, review: { create: mocks.create } } }));

import { POST } from "./route";

const bookingId = "00000000-0000-4000-8000-000000000111";
const valid = { bookingId, displayName: "Ayesha K.", rating: 5, body: "The room worked well for our family.", consentConfirmed: true, published: false };
const request = (body = valid) => new Request("http://localhost/api/admin/reviews", { method: "POST", body: JSON.stringify(body) });

describe("admin review creation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue(null);
    mocks.admin.mockResolvedValue({ id: "admin-id" });
    mocks.booking.mockResolvedValue({ status: "CONFIRMED", reference: "BK-2026-REAL001", review: null });
    mocks.create.mockResolvedValue({ id: "review-id" });
  });

  it("requires admin authorization", async () => {
    mocks.guard.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("requires a genuine eligible booking and consent", async () => {
    mocks.booking.mockResolvedValue({ status: "PENDING", reference: "BK-2026-REAL001", review: null });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.booking.mockResolvedValue({ status: "CONFIRMED", reference: "BK-2026-REAL001", review: null });
    await expect(POST(request({ ...valid, consentConfirmed: false }))).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects fictional development bookings", async () => {
    mocks.booking.mockResolvedValue({ status: "CONFIRMED", reference: "BK-2026-DEMO06", review: null });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates a private draft unless publication is selected", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.publishedAt).toBeNull();
    expect(mocks.create.mock.calls[0][0].data.consentConfirmedAt).toBeInstanceOf(Date);
    expect(await response.json()).toEqual({ id: "review-id" });
  });
});
