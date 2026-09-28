import { PublicShell } from "@/components/public-shell";
import { RequestForm } from "@/components/request-form";
import { metadata as makeMetadata } from "@/lib/seo";

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
};

export default async function RequestPage({ searchParams }: { searchParams: Promise<RequestSearch> }) {
  const query = await searchParams;
  return <PublicShell showFloatingWhatsApp={false}><div className="form-wrap ms-request-page"><div className="container">
    <div className="ms-request-hero"><div><p className="ms-kicker">PERSONALIZED ACCOMMODATION ASSISTANCE</p><h1>Tell us about your stay.</h1><p>Share your plans once, then our team will check suitable options and help you compare them. Availability is confirmed after your request.</p></div><span className="ms-request-hero-mark" aria-hidden="true">مقام</span></div>
    <RequestForm initialDestination={query.destination} initialNeed={query.need} initialCheckIn={query.checkIn} initialCheckOut={query.checkOut} initialAdults={query.adults} initialRooms={query.rooms}/>
  </div></div></PublicShell>;
}
