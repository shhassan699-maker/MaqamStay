import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  rate: vi.fn(),
  transaction: vi.fn(),
  upsertCustomer: vi.fn(),
  counter: vi.fn(),
  createRequest: vi.fn(),
  hotel: vi.fn(),
}));
vi.mock("@/lib/inventory/request-hotel", () => ({
  resolveRequestHotel: mocks.hotel,
}));
vi.mock("@/lib/http", () => ({
  publicWriteGuard: mocks.guard,
  failure: (error: unknown) => {
    throw error;
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimited: mocks.rate }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
import { POST } from "./route";
describe("catalog selection resolves on the server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue(null);
    mocks.rate.mockResolvedValue(false);
    mocks.upsertCustomer.mockResolvedValue({ id: "customer-id" });
    mocks.counter.mockResolvedValue({ value: 124 });
    mocks.createRequest.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        customer: { upsert: mocks.upsertCustomer },
        requestCounter: { upsert: mocks.counter },
        accommodationRequest: { create: mocks.createRequest },
      }),
    );
  });
  it("stores only resolved hotel identity in the existing assisted request activity", async () => {
    mocks.hotel.mockResolvedValue({
      slug: "approved-hotel",
      name: "Approved name",
      city: "Makkah",
    });
    const response = await POST(
      new Request("http://localhost/api/requests", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          hotelSlug: "approved-hotel",
          hotelName: "Client forged name",
          supplierPrice: "private",
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.hotel).toHaveBeenCalledWith(
      "approved-hotel",
      payload.destinations,
    );
    const stored = JSON.stringify(mocks.createRequest.mock.calls[0][0]);
    expect(stored).toContain("Approved name");
    expect(stored).not.toMatch(/Client forged name|supplierPrice/);
  });
  it("rejects disappeared or mismatched hotel selection before customer database writes", async () => {
    mocks.hotel.mockRejectedValue(new Error("catalog down or unpublished"));
    const response = await POST(
      new Request("http://localhost/api/requests", {
        method: "POST",
        body: JSON.stringify({ ...payload, hotelSlug: "unpublished-hotel" }),
      }),
    );
    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("catalog down");
  });
});
const payload = {
  destinations: [
    { destination: "MAKKAH", checkIn: "2030-11-10", checkOut: "2030-11-16" },
  ],
  adults: 2,
  children: 1,
  rooms: 1,
  budgetType: "TOTAL",
  budgetAmount: 150000,
  budgetCurrency: "PKR",
  preferences: ["Family Friendly"],
  requirements: "Near Haram",
  name: "Test Guest",
  whatsapp: "+923001234567",
  phone: "+923001234567",
  email: "",
  city: "Lahore",
  country: "Pakistan",
  privacyAccepted: true,
};
describe("request creation API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue(null);
    mocks.rate.mockResolvedValue(false);
    mocks.upsertCustomer.mockResolvedValue({ id: "customer-id" });
    mocks.counter.mockResolvedValue({ value: 123 });
    mocks.createRequest.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        customer: { upsert: mocks.upsertCustomer },
        requestCounter: { upsert: mocks.counter },
        accommodationRequest: { create: mocks.createRequest },
      }),
    );
  });
  it("creates a customer, normalized request and human-readable number", async () => {
    const response = await POST(
      new Request("http://localhost/api/requests", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).requestNumber).toMatch(/^MS-\d{4}-000123$/);
    expect(mocks.upsertCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ where: { whatsapp: "+923001234567" } }),
    );
    expect(mocks.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "customer-id",
          preferences: ["Family Friendly"],
          destinations: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ destination: "MAKKAH" }),
            ]),
          }),
        }),
      }),
    );
  });
  it("does not return supplier prices, markup or commission", async () => {
    const response = await POST(
      new Request("http://localhost/api/requests", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
    const text = JSON.stringify(await response.json());
    expect(text).not.toMatch(
      /supplierPrice|markup|commission|internalNotes|supplierId/,
    );
  });
  it("rate limits submissions before touching the database", async () => {
    mocks.rate.mockResolvedValue(true);
    const response = await POST(
      new Request("http://localhost/api/requests", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
    expect(response.status).toBe(429);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
