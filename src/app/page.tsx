import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BedDouble, CalendarCheck2,
  Compass, HeartHandshake, MapPin, SearchCheck,
  ShieldCheck, SlidersHorizontal, Star, Users, Wallet,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { QuickInquiry } from "@/components/quick-inquiry";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { whatsappUrl } from "@/lib/whatsapp";
import { metadata as makeMetadata } from "@/lib/seo";
import { getPublishedReviews } from "@/lib/published-reviews";

export const dynamic = "force-dynamic";

export const metadata = makeMetadata(
  "Find the Right Place to Stay in Saudi Arabia",
  "Tell us your destination, dates, budget and preferences. MaqamStay helps you compare suitable Saudi accommodation options.",
  "/",
);

const destinations = [
  { name: "Makkah", image: "/images/makkah.jpg", alt: "The Grand Mosque and Abraj Al Bait in Makkah", description: "Accommodation for an Umrah journey that fits your group and plans." },
  { name: "Madinah", image: "/images/madinah.jpg", alt: "The Prophet's Mosque in Madinah at dusk", description: "A comfortable base for the time you spend in Madinah." },
  { name: "Jeddah", image: "/images/jeddah.jpg", alt: "The Jeddah waterfront and a white seaside mosque", description: "Coastal stays for stopovers, family visits and longer trips." },
  { name: "Riyadh", image: "/images/riyadh.jpg", alt: "The skyline of Riyadh", description: "Well-located accommodation for business and city travel." },
];

const steps = [
  { title: "Tell us your plans", copy: "Share destinations, dates, travelers and the things that matter to you.", icon: CalendarCheck2 },
  { title: "We check options", copy: "Our team asks accommodation suppliers about suitable stays.", icon: SearchCheck },
  { title: "Compare your quote", copy: "Review room details, locations and clear final customer prices.", icon: SlidersHorizontal },
  { title: "Choose your stay", copy: "Tell us which option you prefer through your private quote link.", icon: HeartHandshake },
  { title: "We help arrange it", copy: "We support the manual booking and confirmation process.", icon: BadgeCheck },
];

const needs = [
  { title: "Hotels Near Haram", copy: "Tell us how close you would like to be in Makkah.", icon: MapPin, destination: "MAKKAH" },
  { title: "Budget Makkah Hotels", copy: "Share a budget that feels right for your trip.", icon: Wallet, destination: "MAKKAH" },
  { title: "Family Hotels", copy: "Consider room setup, children and a comfortable location.", icon: Users },
  { title: "Hotels Near Masjid an-Nabawi", copy: "Tell us the Madinah area or walking distance you prefer.", icon: MapPin, destination: "MADINAH" },
  { title: "Premium Saudi Hotels", copy: "Ask for extra comfort and your preferred hotel category.", icon: BedDouble },
  { title: "Elderly-Friendly Stays", copy: "Let us know about mobility and access needs.", icon: HeartHandshake },
];

const reasons = [
  { title: "Personalized suggestions", copy: "We focus on the plans and preferences you send us.", icon: Compass },
  { title: "Saudi stay guidance", copy: "Discuss location, access and room choices with our team.", icon: MapPin },
  { title: "Budget-conscious options", copy: "Share a nightly or total budget before we prepare options.", icon: Wallet },
  { title: "Family considerations", copy: "Rooms, children and accessibility can all shape the shortlist.", icon: Users },
  { title: "WhatsApp assistance", copy: "Ask questions in a familiar conversation after your request.", icon: WhatsAppIcon },
  { title: "Booking coordination", copy: "We guide you through the next steps once you choose.", icon: HeartHandshake },
];

const faqs = [
  { question: "Are the hotel options available instantly?", answer: "No. Our team checks suitable accommodation and prices with suppliers after you submit your request. We then share available options with you." },
  { question: "Can I request both Makkah and Madinah?", answer: "Yes. The request form supports multiple destinations, each with its own check-in and check-out dates." },
  { question: "Do I need to pay when I submit a request?", answer: "No payment is collected by this website. Any booking and payment details are discussed after you choose an option." },
  { question: "How will I receive my hotel options?", answer: "Our team can share a private quote link with you through WhatsApp. Each option shows the final customer price and the details you need to compare." },
];

export default async function Home() {
  const reviews = await getPublishedReviews();
  return <PublicShell>
    <section className="ms-hero"><div className="container ms-hero-grid">
      <div className="ms-hero-content">
        <p className="ms-eyebrow"><span /> SAUDI ACCOMMODATION, MADE PERSONAL</p>
        <h1>Your stay in Saudi Arabia, <em>thoughtfully arranged.</em></h1>
        <p className="ms-hero-lede">Tell us your destination, dates, budget and preferences. We&apos;ll help you compare suitable accommodation and choose a place that feels right for your trip.</p>
        <div className="ms-hero-actions"><Link href="/request" className="button button-primary">Find me a hotel <ArrowRight size={18}/></Link><a href={whatsappUrl("Assalamualaikum, I'd like help finding a hotel in Saudi Arabia.")} className="button button-secondary" target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={20}/> Chat on WhatsApp</a></div>
        <div className="ms-hero-points"><span><ShieldCheck size={15}/> Assisted, personal service</span><span><Users size={15}/> Family plans welcome</span><span><CalendarCheck2 size={15}/> No live booking claims</span></div>
      </div>
      <div className="ms-hero-side"><div className="ms-hero-photo"><Image src="/images/makkah-hero.jpg" alt="Grand Mosque and Abraj Al Bait in Makkah" fill sizes="(max-width: 900px) 100vw, 48vw" preload/></div><QuickInquiry/></div>
    </div></section>

    <section className="ms-trust-strip"><div className="container">{[
      [ShieldCheck, "Requests reviewed by our team", "Human guidance from the first step"],
      [Users, "Built for family travel", "Tell us about your whole group"],
      [Wallet, "Clear customer prices", "Compare the final quote you receive"],
      [WhatsAppIcon, "WhatsApp follow-up", "Ask questions before deciding"],
    ].map(([Icon, title, copy]) => <div className="ms-trust-item" key={title as string}><span><Icon size={19}/></span><div><strong>{title as string}</strong><small>{copy as string}</small></div></div>)}</div></section>

    <section className="ms-section ms-destinations"><div className="container"><div className="ms-section-head"><div><p className="ms-kicker">PLACES WE CAN HELP WITH</p><h2>Destination accommodation portfolios</h2></div><p>From Makkah and Madinah to Saudi city stays, share the location that matters to your journey.</p></div><div className="ms-destination-grid">{destinations.map((destination, index) => <article className="ms-destination-card" key={destination.name}><Link href={`/${destination.name.toLowerCase()}`} className="ms-destination-photo"><Image src={destination.image} alt={destination.alt} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw" loading={index === 0 ? "eager" : "lazy"}/><span>0{index + 1} / SAUDI ARABIA</span><strong>{destination.name}</strong></Link><div className="ms-destination-info"><p>{destination.description}</p><Link href={`/request?destination=${destination.name.toUpperCase()}`}>Request {destination.name} options <ArrowUpRight size={15}/></Link></div></article>)}</div></div></section>

    <section className="ms-section ms-process"><div className="container"><div className="ms-section-head ms-section-head-centered"><p className="ms-kicker">THE SIMPLE PROCESS</p><h2>How MaqamStay assisted booking works</h2><p>Real people help you compare options. Availability and prices are checked after you send your request.</p></div><div className="ms-process-grid">{steps.map((step, index) => <div className="ms-process-card" key={step.title}><span className="ms-process-icon"><step.icon size={21}/></span><span className="ms-process-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.copy}</p></div>)}</div><div className="ms-process-note"><ShieldCheck size={20}/><span>Every option is shared as a proposal until booking details are confirmed.</span><Link href="/how-it-works">See how it works <ArrowRight size={15}/></Link></div></div></section>

    <section className="ms-section ms-categories"><div className="container"><div className="ms-section-head ms-section-head-centered"><p className="ms-kicker">A STAY FOR YOUR PLANS</p><h2>Popular accommodation categories</h2><p>Start with a priority. We&apos;ll ask for the rest of your details in the request form.</p></div><div className="ms-category-grid">{needs.map(need => <Link className="ms-category-card" href={`/request?need=${encodeURIComponent(need.title)}${need.destination ? `&destination=${need.destination}` : ""}`} key={need.title}><span><need.icon size={20}/></span><div><h3>{need.title}</h3><p>{need.copy}</p></div><ArrowUpRight size={18}/></Link>)}</div></div></section>

    <section className="ms-section ms-guidance"><div className="container"><div className="ms-section-head ms-section-head-centered"><p className="ms-kicker">WHY MAQAMSTAY</p><h2>Dignified Saudi hospitality guidance</h2><p>Online portals can be overwhelming when you&apos;re planning for family. We help narrow the choices around what matters to you.</p></div><div className="ms-guidance-grid">{reasons.map(reason => <div className="ms-guidance-card" key={reason.title}><span><reason.icon size={20}/></span><h3>{reason.title}</h3><p>{reason.copy}</p></div>)}</div></div></section>

    {reviews.length > 0 && <section className="ms-section ms-reviews" aria-labelledby="home-reviews-title"><div className="container"><div className="ms-section-head ms-section-head-centered"><p className="ms-kicker">CUSTOMER EXPERIENCES</p><h2 id="home-reviews-title">Words from our travelers</h2><p>Feedback shared by customers who arranged their stay with MaqamStay.</p></div><div className="ms-review-grid">{reviews.map(review => <figure className="ms-review-card" key={review.id}><div className="ms-review-stars" role="img" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: review.rating }, (_, index) => <Star key={index} size={17} fill="currentColor" aria-hidden="true" />)}</div><blockquote>“{review.body}”</blockquote><figcaption><span className="ms-review-avatar" aria-hidden="true">{review.displayName.charAt(0).toUpperCase()}</span><span><strong>{review.displayName}</strong><small>{review.destination.charAt(0) + review.destination.slice(1).toLowerCase()} stay</small></span></figcaption></figure>)}</div></div></section>}

    <section className="ms-section ms-comparison"><div className="container"><div className="ms-section-head"><div><p className="ms-kicker">A CLEAR WAY TO CHOOSE</p><h2>Your options, easy to compare</h2></div><p>When we have checked suitable stays, your private quote brings the important details together.</p></div><div className="ms-comparison-grid">{[
      [MapPin, "Location & distance", "See the destination and any available distance details."],
      [BedDouble, "Room & inclusions", "Compare the room, meal plan, nights and key features."],
      [Wallet, "Final customer price", "Review a clear selling price for each hotel option."],
    ].map(([Icon, title, copy]) => <div className="ms-comparison-card" key={title as string}><span><Icon size={24}/></span><h3>{title as string}</h3><p>{copy as string}</p><span className="ms-comparison-line" /></div>)}</div></div></section>

    <section className="ms-section ms-home-request"><div className="container"><div className="ms-section-head ms-section-head-centered"><p className="ms-kicker">START YOUR REQUEST</p><h2>Tell us what your trip requires</h2><p>A few details let our team look for accommodation that fits your plans.</p></div><div className="ms-home-request-card"><div><span className="ms-request-dot"/> Makkah &amp; Madinah <span className="ms-request-dot"/> Family travel <span className="ms-request-dot"/> Your budget</div><p>Choose destinations, set separate dates, and tell us the room setup and location you prefer.</p><Link href="/request" className="button button-primary">Start my accommodation request <ArrowRight size={17}/></Link></div></div></section>

    <section className="ms-section ms-faq-preview"><div className="container"><div className="ms-section-head ms-section-head-centered"><p className="ms-kicker">GOOD TO KNOW</p><h2>Clear answers about our assisted service</h2></div><div className="ms-faq-list">{faqs.map(faq => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</div><div className="ms-faq-more"><Link href="/faq">View all questions <ArrowRight size={15}/></Link></div></div></section>

    <section className="ms-closing"><div className="container"><div className="ms-closing-panel"><p className="ms-kicker">PERSONAL ACCOMMODATION HELP</p><h2>Not sure which stay is right for your trip?</h2><p>Tell us your requirements and we&apos;ll help you compare suitable options. Your booking is arranged manually after you choose.</p><div><Link href="/request" className="button ms-button-gold">Get hotel options <ArrowRight size={17}/></Link><a href={whatsappUrl("Assalamualaikum, I need help choosing a Saudi hotel.")} target="_blank" rel="noopener noreferrer" className="button ms-button-outline"><WhatsAppIcon size={19}/> Chat on WhatsApp</a></div><small><ShieldCheck size={13}/> No live inventory claims · No customer account required</small></div></div></section>
  </PublicShell>;
}
