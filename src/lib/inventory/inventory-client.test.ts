import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  getHotels,
  getHotelBySlug,
  getCities,
  getAreas,
  getLandmarks,
  getNearbyHotels,
} from "./inventory-client";
import { publicHotelSchema } from "./inventory-types";
const hotel = {
  name: "Fictional Contract Hotel",
  slug: "fictional-contract-hotel",
  description: "A fictional profile for boundary tests.",
  shortDescription: "Fictional hotel",
  starRating: 4,
  propertyType: "HOTEL",
  featured: false,
  city: { name: "Makkah", slug: "makkah" },
  address: "",
  amenities: [],
  media: [],
  rooms: [],
  distances: [],
  access: {
    notes: "",
    shuttle: false,
    privateTransportation: false,
    wheelchair: false,
    parking: false,
  },
  policies: {
    checkIn: "15:00",
    checkOut: "12:00",
    child: "",
    extraBed: "",
    cancellation: "",
    other: "",
  },
  seo: { title: "", description: "" },
  updatedAt: "2026-10-05T00:00:00.000Z",
  availability: {
    mode: "CATALOG_ONLY",
    message: "Availability is checked after request.",
  },
};
const page = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  pages: items.length ? 1 : 0,
});
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("INVENTORY_API_URL", "https://inventory-staging.example.test");
  vi.stubEnv(
    "INVENTORY_CATALOG_API_KEY",
    `ms_catalog_test_key_${Math.random()}`,
  );
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("server-only inventory boundary", () => {
  it("calls only catalog endpoints and sends no browser/admin cookies", async () => {
    fetchMock.mockResolvedValue(Response.json(page([hotel])));
    expect((await getHotels({ city: "makkah" })).items[0].name).toBe(
      hotel.name,
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.pathname).toBe("/api/v1/public/hotels");
    expect(options.headers["X-API-Key"]).toBe(
      process.env.INVENTORY_CATALOG_API_KEY,
    );
    expect(options.headers.Cookie).toBeUndefined();
    expect(options.cache).toBe("no-store");
    expect(options.redirect).toBe("error");
  });
  it("revalidates ETag and refuses cached content after unpublish or key revocation", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(hotel, { headers: { ETag: '"test"' } }),
    );
    await getHotelBySlug(hotel.slug);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    expect((await getHotelBySlug(hotel.slug)).name).toBe(hotel.name);
    expect(fetchMock.mock.calls[1][1].headers["If-None-Match"]).toBe('"test"');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(getHotelBySlug(hotel.slug)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(getHotelBySlug(hotel.slug)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it.each([401, 403, 404, 429, 500, 503])(
    "returns safe errors for status %s without upstream body or secrets",
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response("supplierPrice secret stack", { status }),
      );
      await expect(getHotels()).rejects.toMatchObject({
        message: "Hotel information is temporarily unavailable.",
      });
    },
  );
  it("handles timeouts, malformed JSON and schema mismatch", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("secret", "TimeoutError"));
    await expect(getHotels()).rejects.toMatchObject({ code: "TIMEOUT" });
    fetchMock.mockResolvedValueOnce(
      new Response("broken", {
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(getHotels()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    fetchMock.mockResolvedValueOnce(Response.json({ anything: "private" }));
    await expect(getHotels()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it.each([
    "supplierPrice",
    "supplierContact",
    "supplierCommercialNotes",
    "contractedRate",
    "markup",
    "commission",
    "adminNotes",
    "internalNotes",
    "createdBy",
    "storageKey",
    "privateMedia",
    "publicationStatus",
    "apiCredentials",
    "sessions",
    "audit",
  ])("rejects private field %s in detail and list", async (field) => {
    const unsafe = { ...hotel, [field]: "PRIVATE" };
    expect(publicHotelSchema.safeParse(unsafe).success).toBe(false);
    fetchMock.mockResolvedValueOnce(Response.json(unsafe));
    await expect(getHotelBySlug(hotel.slug)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    fetchMock.mockResolvedValueOnce(Response.json(page([unsafe])));
    await expect(getHotels()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("validates areas, landmarks and nearby including nested private fields", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(page([{ name: "Area", slug: "area", description: "" }])),
    );
    expect((await getAreas("makkah")).items).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(
      Response.json(page([{ name: "City", slug: "city", description: "" }])),
    );
    await getCities();
    fetchMock.mockResolvedValueOnce(
      Response.json(
        page([
          {
            name: "Landmark",
            slug: "landmark",
            description: "",
            internalNotes: "private",
          },
        ]),
      ),
    );
    await expect(getLandmarks()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    fetchMock.mockResolvedValueOnce(
      Response.json({
        items: [
          { hotel: { ...hotel, storageKey: "private" }, distanceMeters: 10 },
        ],
      }),
    );
    await expect(getNearbyHotels(39.8, 21.4)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("rejects arbitrary URLs, query operators and credentialed URLs before fetching", async () => {
    await expect(getHotelBySlug("../admin/users")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(getHotels({ city: "$ne" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    vi.stubEnv("INVENTORY_API_URL", "http://169.254.169.254");
    await expect(getHotels()).rejects.toMatchObject({ code: "CONFIGURATION" });
    vi.stubEnv(
      "INVENTORY_API_URL",
      "https://user:password@inventory.example.test",
    );
    await expect(getHotels()).rejects.toMatchObject({ code: "CONFIGURATION" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
