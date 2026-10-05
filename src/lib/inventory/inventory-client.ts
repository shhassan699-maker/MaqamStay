import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  publicHotelSchema,
  publicLocationSchema,
  pageSchema,
  hotelFiltersSchema,
  slugSchema,
  type HotelFilters,
} from "./inventory-types";
import { InventoryError } from "./inventory-errors";
import {
  readCatalogCache,
  writeCatalogCache,
  evictCatalogCache,
} from "./inventory-cache";

function configuration() {
  const key = process.env.INVENTORY_CATALOG_API_KEY;
  let base: URL;
  try {
    base = new URL(process.env.INVENTORY_API_URL || "");
  } catch {
    throw new InventoryError("CONFIGURATION");
  }
  if (
    !key ||
    key.length < 20 ||
    key.length > 200 ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/" ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
      ))
  )
    throw new InventoryError("CONFIGURATION");
  return { base, key };
}
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new InventoryError("INVALID_INPUT");
  return result.data;
}
async function catalog<T>(
  route: string,
  query: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const { base, key } = configuration();
  // This helper is private; exported functions specify fixed public routes only.
  const url = new URL(`/api/v1/public/${route}`, base);
  for (const [name, value] of Object.entries(query))
    if (value !== undefined) url.searchParams.set(name, String(value));
  const cacheKey = createHash("sha256").update(`${key}:${url}`).digest("hex");
  const cached = readCatalogCache(cacheKey);
  const headers: Record<string, string> = {
    "X-API-Key": key,
    Accept: "application/json",
  };
  if (cached) headers["If-None-Match"] = cached.etag;
  const timeout = Number(process.env.INVENTORY_TIMEOUT_MS || 5000);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 15000)
    throw new InventoryError("CONFIGURATION");
  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    });
    if (response.status === 304 && cached)
      return inputResponse(schema, cached.body);
    if (!response.ok) {
      const code =
        response.status === 404
          ? "NOT_FOUND"
          : [401, 403].includes(response.status)
            ? "UNAUTHORIZED"
            : response.status === 429
              ? "RATE_LIMITED"
              : "UNAVAILABLE";
      throw new InventoryError(code);
    }
    if (
      !response.headers.get("content-type")?.includes("application/json") ||
      !response.body
    )
      throw new InventoryError("INVALID_RESPONSE");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new InventoryError("INVALID_RESPONSE");
      }
      chunks.push(value);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new InventoryError("INVALID_RESPONSE");
    }
    const result = inputResponse(schema, body);
    writeCatalogCache(cacheKey, response.headers.get("etag"), result);
    return result;
  } catch (error) {
    evictCatalogCache(cacheKey);
    if (error instanceof InventoryError) throw error;
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new InventoryError("TIMEOUT");
    throw new InventoryError("UNAVAILABLE");
  }
}
function inputResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new InventoryError("INVALID_RESPONSE");
  return result.data;
}
export async function getHotels(filters: HotelFilters = {}) {
  return catalog(
    "hotels",
    input(hotelFiltersSchema, filters),
    pageSchema(publicHotelSchema),
  );
}
export async function getHotelBySlug(slug: string) {
  return catalog(`hotels/${input(slugSchema, slug)}`, {}, publicHotelSchema);
}
const locationFilters = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  city: slugSchema.optional(),
});
export async function getCities() {
  return catalog("cities", { limit: 100 }, pageSchema(publicLocationSchema));
}
export async function getAreas(city?: string, page = 1) {
  return catalog(
    "areas",
    input(locationFilters, { city, page }),
    pageSchema(publicLocationSchema),
  );
}
export async function getLandmarks(city?: string, page = 1) {
  return catalog(
    "landmarks",
    input(locationFilters, { city, page }),
    pageSchema(publicLocationSchema),
  );
}
export async function getNearbyHotels(
  longitude: number,
  latitude: number,
  radiusMeters = 1000,
) {
  const query = input(
    z.strictObject({
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
      radiusMeters: z.number().positive().max(10000),
    }),
    { longitude, latitude, radiusMeters },
  );
  return catalog(
    "hotels/nearby",
    query,
    z.strictObject({
      items: z
        .array(
          z.strictObject({
            hotel: publicHotelSchema,
            distanceMeters: z.number().min(0),
          }),
        )
        .max(100),
    }),
  );
}
