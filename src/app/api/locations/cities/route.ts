import { z } from "zod";
import { findCities, isKnownCountryCode } from "@/lib/city-search";

const querySchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  q: z.string().trim().max(80).optional().default(""),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    country: url.searchParams.get("country"),
    q: url.searchParams.get("q") ?? "",
  });
  if (!parsed.success || !isKnownCountryCode(parsed.data.country)) {
    return Response.json({ error: "Enter a valid country and city search." }, { status: 400 });
  }
  return Response.json({ cities: findCities(parsed.data.country, parsed.data.q) });
}
