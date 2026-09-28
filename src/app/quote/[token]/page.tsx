import { notFound } from "next/navigation";
import { BedDouble, CalendarDays, Check, Clock3, MapPin, ShieldCheck, Users, UtensilsCrossed } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { InterestButton } from "@/components/interest-button";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { db } from "@/lib/db";
import { getPublicQuote } from "@/lib/public-quote";
import { dateLabel, titleCase } from "@/lib/format";
import { money } from "@/lib/pricing";
import { whatsappUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Hotel Options | MaqamStay", robots: { index: false, follow: false } };

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getPublicQuote(token);
  if (!quote) notFound();

  const opened = await db.quote.updateMany({ where: { id: quote.id, openedAt: null }, data: { openedAt: new Date() } });
  if (opened.count) {
    const request = await db.quote.findUniqueOrThrow({ where: { id: quote.id }, select: { requestId: true } });
    await db.activityLog.create({ data: { requestId: request.requestId, type: "QUOTE_OPENED", description: "Customer quote opened" } });
  }

  const request = quote.request;
  const destination = request.destinations.map(d => d.otherName || titleCase(d.destination)).join(" & ");
  const dates = request.destinations.map(d => `${dateLabel(d.checkIn)} to ${dateLabel(d.checkOut)}`).join(" · ");
  const guests = request.adults + request.children;

  return <PublicShell showFloatingWhatsApp={false}><div className="ms-quote-page"><div className="container">
    <div className="ms-quote-secure"><ShieldCheck size={16}/><span>Private quote prepared for {request.customer.name}</span><span>·</span><span>Options are subject to final availability</span></div>
    <header className="ms-quote-heading"><p className="ms-kicker">YOUR PERSONAL HOTEL SELECTION</p><h1>Your MaqamStay Hotel Options</h1><p>Compare the details below and tell us which stay interests you. Our team will help with the next steps.</p></header>
    <section className="ms-quote-itinerary" aria-label="Your travel details"><div><MapPin size={20}/><span><small>DESTINATION</small><strong>{destination}</strong></span></div><div><CalendarDays size={20}/><span><small>TRAVEL DATES</small><strong>{dates}</strong></span></div><div><Users size={20}/><span><small>TRAVELERS</small><strong>{guests} guests · {request.rooms} {request.rooms === 1 ? "room" : "rooms"}</strong></span></div><div><Check size={20}/><span><small>REFERENCE</small><strong>{request.requestNumber}</strong></span></div></section>
    <div className="ms-quote-section-head"><div><p className="ms-kicker">HANDPICKED FOR YOUR REQUEST</p><h2>Explore your options</h2></div><span>{quote.options.length} {quote.options.length === 1 ? "option" : "options"} to consider</span></div>
    <div className="ms-quote-grid">{quote.options.map(option => {
      const hotel = option.hotelOption;
      return <article className={`ms-quote-card${option.recommended ? " ms-quote-recommended" : ""}`} key={hotel.id}>
        <div className="ms-quote-photo" style={hotel.imageUrl ? { backgroundImage: `url("${hotel.imageUrl}")` } : undefined} role="img" aria-label={hotel.imageUrl ? `Image of ${hotel.hotelName}` : "Hotel image unavailable"}>
          {!hotel.imageUrl && <BedDouble size={54} strokeWidth={1} aria-hidden="true"/>}
          <span>OPTION {option.position}</span>
          {option.recommended && <strong><Check size={13}/> RECOMMENDED</strong>}
        </div>
        <div className="ms-quote-card-content"><div className="ms-quote-card-eyebrow">{option.label || `${hotel.stars ? `${hotel.stars} STAR · ` : ""}${titleCase(hotel.destination)}`}</div><h3>{hotel.hotelName}</h3><p className="ms-quote-card-location"><MapPin size={15}/>{titleCase(hotel.destination)}{hotel.distance ? ` · ${hotel.distance}` : ""}</p>
          <div className="ms-quote-features"><span><BedDouble size={16}/>{hotel.roomType}</span><span><UtensilsCrossed size={16}/>{hotel.mealPlan || "Meal details on request"}</span><span><Clock3 size={16}/>{hotel.nights} {hotel.nights === 1 ? "night" : "nights"}</span></div>
          {hotel.features.length > 0 && <p className="ms-quote-extra">{hotel.features.join(" · ")}</p>}
          {hotel.cancellationTerms && <p className="ms-quote-terms"><strong>Cancellation:</strong> {hotel.cancellationTerms}</p>}
          <div className="ms-quote-price"><small>FINAL CUSTOMER PRICE</small><strong>{money(option.finalPrice.toString(), hotel.currency)}</strong><span>For the stay shown above</span></div>
          <InterestButton token={token} optionId={hotel.id} position={option.position} hotelName={hotel.hotelName} requestNumber={request.requestNumber}/>
        </div>
      </article>;
    })}</div>
    <div className="ms-quote-next"><div><span><WhatsAppIcon size={23}/></span><div><h2>Need help choosing?</h2><p>Ask us about the location, room details or how the booking process works.</p></div></div><a className="button button-primary" href={whatsappUrl(`Assalamualaikum, I have a question about my MaqamStay quote ${request.requestNumber}.`)} target="_blank" rel="noopener noreferrer">Ask on WhatsApp <WhatsAppIcon size={19}/></a></div>
    <p className="ms-quote-disclaimer"><ShieldCheck size={15}/> Availability and final booking details are confirmed by our team. Selecting an option records your interest; it does not create an instant booking.</p>
  </div></div></PublicShell>;
}
