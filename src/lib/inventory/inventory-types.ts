import { z } from "zod";

// Independent consumer contract. No imports from the inventory service repository.
const text = (max: number) => z.string().max(max);
export const slugSchema = z
  .string()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const point = z.strictObject({
  type: z.literal("Point"),
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
});
const identity = z.strictObject({ name: text(180), slug: slugSchema });
export const publicHotelSchema = z.strictObject({
  name: text(180),
  slug: slugSchema,
  alternativeName: text(180).optional(),
  arabicName: text(180).optional(),
  description: text(15000),
  shortDescription: text(500),
  starRating: z.number().int().min(0).max(5),
  propertyType: text(50),
  featured: z.boolean(),
  city: identity,
  area: identity.optional(),
  address: text(1000),
  location: point.optional(),
  amenities: z
    .array(
      z.strictObject({ name: text(180), slug: slugSchema, icon: text(50) }),
    )
    .max(100),
  media: z
    .array(
      z.strictObject({
        url: z.string().regex(/^\/api\/v1\/public\/media\/[a-f\d]{24}$/),
        alt: text(500),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    )
    .max(100),
  rooms: z
    .array(
      z.strictObject({
        name: text(180),
        description: text(5000),
        bedConfiguration: text(500),
        maxAdults: z.number().int().min(1),
        maxChildren: z.number().int().min(0),
        maxGuests: z.number().int().min(1),
        roomSize: z.number().positive().optional(),
        bathroomType: text(100),
        viewType: text(100),
        kitchenette: z.boolean(),
      }),
    )
    .max(500),
  distances: z
    .array(
      z.strictObject({
        landmark: text(180),
        landmarkSlug: slugSchema.optional(),
        distanceMeters: z.number().min(0),
        walkingMinutes: z.number().min(0).optional(),
        drivingMinutes: z.number().min(0).optional(),
        transportMode: z.enum(["WALK", "DRIVE", "SHUTTLE", "OTHER"]),
        verificationStatus: z.enum([
          "UNVERIFIED",
          "MANUALLY_VERIFIED",
          "MAP_VERIFIED",
          "SUPPLIER_PROVIDED",
        ]),
        approximate: z.boolean(),
        lastVerifiedAt: z.iso.datetime().optional(),
      }),
    )
    .max(500),
  access: z.strictObject({
    notes: text(3000),
    shuttle: z.boolean(),
    privateTransportation: z.boolean(),
    wheelchair: z.boolean(),
    parking: z.boolean(),
  }),
  policies: z.strictObject({
    checkIn: text(5),
    checkOut: text(5),
    child: text(3000),
    extraBed: text(3000),
    cancellation: text(3000),
    other: text(3000),
  }),
  seo: z.strictObject({ title: text(180), description: text(500) }),
  updatedAt: z.iso.datetime(),
  availability: z.strictObject({
    mode: z.literal("CATALOG_ONLY"),
    message: text(1000),
  }),
});
export const publicLocationSchema = z.strictObject({
  name: text(180),
  slug: slugSchema,
  description: text(15000),
  location: point.optional(),
  type: text(50).optional(),
});
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    items: z.array(item).max(100),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    pages: z.number().int().min(0),
  });
export const hotelFiltersSchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
    city: slugSchema.optional(),
    area: slugSchema.optional(),
    starRating: z.coerce.number().int().min(0).max(5).optional(),
    propertyType: z
      .enum([
        "HOTEL",
        "APARTMENT",
        "APARTHOTEL",
        "RESORT",
        "HOSTEL",
        "GUESTHOUSE",
        "VILLA",
        "OTHER",
      ])
      .optional(),
    amenity: slugSchema.optional(),
    landmark: slugSchema.optional(),
    maxDistance: z.coerce.number().min(0).max(100000).optional(),
    wheelchair: z.enum(["true"]).optional(),
    shuttle: z.enum(["true"]).optional(),
  })
  .refine(
    (v) => v.maxDistance === undefined || !!v.landmark,
    "Select a landmark for a distance filter",
  );
export type PublicHotel = z.infer<typeof publicHotelSchema>;
export type PublicLocation = z.infer<typeof publicLocationSchema>;
export type CatalogPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};
export type HotelFilters = z.input<typeof hotelFiltersSchema>;
