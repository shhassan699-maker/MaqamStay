import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ hotel: vi.fn() }));
vi.mock("./inventory-client", () => ({ getHotelBySlug: mocks.hotel }));
import { resolveRequestHotel } from "./request-hotel";
describe("selected hotel destination consistency", () => {
  it("returns the safe resolved identifier/name/city only", async () => {
    mocks.hotel.mockResolvedValue({
      slug: "approved-hotel",
      name: "Approved hotel",
      city: { slug: "makkah", name: "Makkah" },
      description: "safe public data",
      supplierPrice: "should not be copied",
    });
    expect(
      await resolveRequestHotel("approved-hotel", [{ destination: "MAKKAH" }]),
    ).toEqual({
      slug: "approved-hotel",
      name: "Approved hotel",
      city: "Makkah",
    });
  });
  it("requires the requested travel destination to match the selected hotel city", async () => {
    mocks.hotel.mockResolvedValue({
      slug: "approved-hotel",
      name: "Approved hotel",
      city: { slug: "makkah", name: "Makkah" },
    });
    await expect(
      resolveRequestHotel("approved-hotel", [{ destination: "MADINAH" }]),
    ).rejects.toThrow("HOTEL_DESTINATION_MISMATCH");
  });
});
