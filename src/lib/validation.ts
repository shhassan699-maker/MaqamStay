import { z } from "zod";

export const destinations = [
  "MAKKAH",
  "MADINAH",
  "JEDDAH",
  "RIYADH",
  "OTHER",
] as const;
export const statuses = [
  "NEW",
  "SUPPLIER_REQUESTED",
  "OPTIONS_RECEIVED",
  "QUOTE_SENT",
  "CUSTOMER_INTERESTED",
  "PAYMENT_PENDING",
  "BOOKED",
  "CANCELLED",
] as const;
export const preferences = [
  "Budget Friendly",
  "Near Haram",
  "Near Masjid an-Nabawi",
  "Family Friendly",
  "Elderly Friendly",
  "Shuttle Required",
  "Breakfast",
  "3 Star",
  "4 Star",
  "5 Star",
] as const;

const date = z.iso.date();
const internationalPhone = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9 ()-]*$/, "Include the country code, e.g. +92")
  .refine((value) => {
    const length = value.replace(/\D/g, "").length;
    return length >= 8 && length <= 15;
  }, "Enter 8–15 digits including country code");
const destination = z
  .object({
    destination: z.enum(destinations),
    otherName: z.string().trim().max(80).optional(),
    checkIn: date,
    checkOut: date,
  })
  .refine((d) => d.checkIn >= new Date().toISOString().slice(0, 10), {
    message: "Check-in cannot be in the past",
    path: ["checkIn"],
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  })
  .refine((d) => d.destination !== "OTHER" || !!d.otherName, {
    message: "Enter the destination",
    path: ["otherName"],
  });

export const requestSchema = z
  .object({
    hotelSlug: z
      .string()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    destinations: z
      .array(destination)
      .min(1)
      .max(5)
      .superRefine((items, ctx) => {
        const names = items.map((x) =>
          x.destination === "OTHER"
            ? `OTHER:${x.otherName?.toLowerCase()}`
            : x.destination,
        );
        if (new Set(names).size !== names.length)
          ctx.addIssue({
            code: "custom",
            message: "Choose each destination once",
          });
      }),
    adults: z.number().int().min(1).max(30),
    children: z.number().int().min(0).max(30),
    rooms: z.number().int().min(1).max(20),
    budgetType: z.enum(["PER_NIGHT", "TOTAL"]).optional(),
    budgetAmount: z.number().positive().max(100000000).optional(),
    budgetCurrency: z.enum(["PKR", "SAR"]).optional(),
    preferences: z.array(z.enum(preferences)).max(10),
    preferredLocation: z.string().trim().max(160).optional(),
    requirements: z.string().trim().max(2000).optional(),
    name: z
      .string()
      .trim()
      .min(2, "Enter your full name (at least 2 characters).")
      .max(100),
    whatsapp: internationalPhone,
    phone: internationalPhone,
    email: z.union([z.email(), z.literal("")]).optional(),
    city: z
      .string()
      .trim()
      .min(2, "Enter your city (at least 2 characters).")
      .max(80),
    country: z
      .string()
      .trim()
      .min(2, "Enter your country (at least 2 characters).")
      .max(80),
    privacyAccepted: z
      .boolean()
      .refine((v) => v, "Please accept the Privacy Policy"),
  })
  .superRefine((v, ctx) => {
    if (
      !!v.budgetType !== !!v.budgetAmount ||
      !!v.budgetAmount !== !!v.budgetCurrency
    )
      ctx.addIssue({
        code: "custom",
        message: "Complete all budget fields or leave all blank",
        path: ["budgetAmount"],
      });
  });

export const optionSchema = z
  .object({
    requestId: z.uuid(),
    supplierId: z.uuid(),
    hotelName: z.string().trim().min(2).max(160),
    destination: z.enum(destinations),
    roomType: z.string().trim().min(2).max(100),
    stars: z.coerce.number().int().min(1).max(5).optional(),
    distance: z.string().trim().max(100).optional(),
    mealPlan: z.string().trim().max(100).optional(),
    checkIn: date,
    checkOut: date,
    imageUrl: z
      .union([z.url().startsWith("https://"), z.literal("")])
      .optional(),
    features: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
    cancellationTerms: z.string().trim().max(500).optional(),
    availabilityNotes: z.string().trim().max(1000).optional(),
    internalNotes: z.string().trim().max(1000).optional(),
    currency: z.enum(["PKR", "SAR"]),
    supplierPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
    taxesFees: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .default("0"),
    markupType: z.enum(["FIXED", "PERCENTAGE"]),
    markupValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
    customerPriceOverride: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    path: ["checkOut"],
    message: "Check-out must be after check-in",
  });

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(8).max(25),
  whatsapp: z.string().trim().max(25).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  notes: z.string().trim().max(2000).optional(),
  active: z.boolean().default(true),
});
export const quoteSchema = z
  .object({
    requestId: z.uuid(),
    optionIds: z.array(z.uuid()).min(1).max(5),
    recommendedId: z.uuid().optional(),
    labels: z.record(z.string(), z.string().trim().max(40)).optional(),
  })
  .refine(
    (v) => new Set(v.optionIds).size === v.optionIds.length,
    "Duplicate options",
  )
  .refine(
    (v) => !v.recommendedId || v.optionIds.includes(v.recommendedId),
    "Recommended option must be selected",
  );
export const bookingSchema = z.object({
  requestId: z.uuid(),
  optionId: z.uuid(),
  supplierReference: z.string().trim().max(100).optional(),
  sellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  supplierCost: z.string().regex(/^\d+(\.\d{1,2})?$/),
  actualCommission: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  paymentStatus: z
    .enum([
      "NOT_REQUIRED",
      "PENDING",
      "PAID_TO_SUPPLIER",
      "PARTIAL",
      "REFUNDED",
    ])
    .default("NOT_REQUIRED"),
  status: z
    .enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "REFUNDED"])
    .default("PENDING"),
  confirmationNotes: z.string().trim().max(2000).optional(),
});

export const reviewSchema = z.object({
  bookingId: z.uuid(),
  displayName: z.string().trim().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(20).max(1200),
  consentConfirmed: z.literal(true),
  published: z.boolean(),
});

export const reviewUpdateSchema = reviewSchema
  .omit({ bookingId: true })
  .partial();
