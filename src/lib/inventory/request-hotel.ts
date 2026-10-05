import "server-only";
import { getHotelBySlug } from "./inventory-client";
export async function resolveRequestHotel(
  slug: string,
  destinations: readonly { destination: string; otherName?: string }[],
) {
  const hotel = await getHotelBySlug(slug);
  if (
    !destinations.some(
      (d) =>
        d.destination.toLowerCase() === hotel.city.slug ||
        (d.destination === "OTHER" &&
          d.otherName?.toLowerCase() === hotel.city.name.toLowerCase()),
    )
  )
    throw new Error("HOTEL_DESTINATION_MISMATCH");
  return { slug: hotel.slug, name: hotel.name, city: hotel.city.name };
}
