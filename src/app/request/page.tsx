import { PublicShell } from "@/components/public-shell";
import { RequestForm } from "@/components/request-form";
import { metadata as makeMetadata } from "@/lib/seo";
import { getHotelBySlug } from "@/lib/inventory/inventory-client";

export const metadata = makeMetadata(
  "Request Saudi Hotel Options",
  "Tell us your Saudi destination, dates, travelers, budget and preferences. Our team will check suitable accommodation options.",
  "/request",
);

type RequestSearch = {
  destination?: string;
  need?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: string;
  rooms?: string;
  hotel?: string;
};

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<RequestSearch>;
}) {
  const query = await searchParams;
  let selectedHotel:
    { slug: string; name: string; city: string; citySlug: string } | undefined;
  if (query.hotel) {
    try {
      const hotel = await getHotelBySlug(query.hotel);
      selectedHotel = {
        slug: hotel.slug,
        name: hotel.name,
        city: hotel.city.name,
        citySlug: hotel.city.slug,
      };
    } catch {
      /* Keep the assisted request usable even when catalog selection cannot be verified. */
    }
  }
  return (
    <PublicShell showFloatingWhatsApp={false}>
      <div className="form-wrap ms-request-page">
        <div className="container">
          <div className="ms-request-hero">
            <div>
              <p className="ms-kicker">PERSONALIZED ACCOMMODATION ASSISTANCE</p>
              <h1>Tell us about your stay.</h1>
              <p>
                Share your plans once, then our team will check suitable options
                and help you compare them. Availability is confirmed after your
                request.
              </p>
            </div>
            <span className="ms-request-hero-mark" aria-hidden="true">
              مقام
            </span>
          </div>
          {query.hotel && !selectedHotel && (
            <p role="status">
              Your selected hotel could not be confirmed. You can still send us
              your accommodation requirements.
            </p>
          )}
          <RequestForm
            initialHotel={selectedHotel}
            initialDestination={
              selectedHotel?.citySlug.toUpperCase() || query.destination
            }
            initialNeed={query.need}
            initialCheckIn={query.checkIn}
            initialCheckOut={query.checkOut}
            initialAdults={query.adults}
            initialRooms={query.rooms}
          />
        </div>
      </div>
    </PublicShell>
  );
}
