import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardList,
  HeartHandshake,
  MapPin,
  MessageCircle,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { metadata as makeMetadata } from "@/lib/seo";
import styles from "./how-it-works.module.css";

export const metadata = makeMetadata(
  "How our accommodation assistance works",
  "Share your Saudi travel plans, review suitable accommodation options, and choose your stay with help from the MaqamStay team. Availability is checked after you enquire.",
  "/how-it-works",
);

const steps = [
  {
    number: "01",
    icon: ClipboardList,
    title: "Tell us what matters.",
    copy: "Share your cities, dates, group size, room needs and budget. Add the little details too, whether that is an easier walk for your parents or space for children.",
    detail: "Your request takes just a few minutes",
  },
  {
    number: "02",
    icon: SearchCheck,
    title: "We look into the options.",
    copy: "Our team checks suitable accommodation with suppliers for your dates and preferences. Every option is reviewed before we share it with you.",
    detail: "Availability is checked after you enquire",
  },
  {
    number: "03",
    icon: SlidersHorizontal,
    title: "Compare with clarity.",
    copy: "Receive a private quote with relevant hotel details, location, room type, meal plan, cancellation terms and the final customer price for each option.",
    detail: "One clear view of your choices",
  },
  {
    number: "04",
    icon: MessageCircle,
    title: "Choose at your pace.",
    copy: "Open your quote on your phone, consider what works for your family and tell us which option interests you through WhatsApp.",
    detail: "Questions are welcome along the way",
  },
  {
    number: "05",
    icon: HeartHandshake,
    title: "We help arrange your stay.",
    copy: "We explain the booking and payment steps, coordinate the chosen option and share confirmation details once the booking is secured.",
    detail: "Confirmation follows the manual booking process",
  },
];

const quoteDetails = [
  { icon: MapPin, label: "Location & access", note: "Know how the location suits your plans" },
  { icon: UsersRound, label: "Room & inclusions", note: "See the room type and meal plan" },
  { icon: CalendarDays, label: "Dates & terms", note: "Review your stay and cancellation conditions" },
  { icon: CheckCheck, label: "Final customer price", note: "Understand the price we are offering" },
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="how-heading">
          <div className={`container ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}><span /> THE MAQAMSTAY WAY</p>
              <h1 id="how-heading">The right stay starts with <em>your plans.</em></h1>
              <p className={styles.heroLead}>Tell us where you are going and what a comfortable stay means to you. We do the checking, share considered options, and help you take the next step.</p>
              <div className={styles.heroActions}>
                <Link href="/request" className={styles.primaryButton}>Start your request <ArrowUpRight size={18} aria-hidden="true" /></Link>
                <a href="#the-process" className={styles.heroTextLink}>Explore the process <ArrowDown size={16} aria-hidden="true" /></a>
              </div>
              <p className={styles.heroAssurance}><ShieldCheck size={17} aria-hidden="true" /> A personal service. Availability is checked after you enquire.</p>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.heroPhoto}>
                <Image src="/images/makkah-hero.jpg" alt="View of Makkah and the Grand Mosque" fill priority sizes="(max-width: 800px) 100vw, 44vw" />
              </div>
              <div className={styles.heroCard} aria-hidden="true">
                <span className={styles.heroCardMark}><Check size={20} /></span>
                <div><strong>More than a hotel list.</strong><small>Advice shaped around your journey.</small></div>
              </div>
              <span className={styles.photoCorner} aria-hidden="true" />
            </div>
          </div>
          <div className={`container ${styles.heroBottom}`}><span>YOUR PLANS</span><span className={styles.bottomRule} /><span>OUR RESEARCH</span><span className={styles.bottomRule} /><span>YOUR CHOICE</span></div>
        </section>

        <section id="the-process" className={styles.process} aria-labelledby="process-heading">
          <div className={`container ${styles.processLayout}`}>
            <div className={styles.processIntro}>
              <p className={styles.kicker}>A HUMAN PROCESS, MADE SIMPLE</p>
              <h2 id="process-heading">From first thought to <em>the right place.</em></h2>
              <p>Five thoughtful steps, with a real person behind the search. You stay informed from the first request through booking confirmation.</p>
              <Link href="/request" className={styles.inlineLink}>Tell us your plans <ArrowRight size={17} aria-hidden="true" /></Link>
              <span className={styles.processIndex} aria-hidden="true">01 / 05</span>
            </div>
            <ol className={styles.stepList}>
              {steps.map((step) => <li key={step.number} className={styles.step} data-reveal>
                <span className={styles.stepNumber}>{step.number}</span>
                <div className={styles.stepBody}>
                  <span className={styles.stepIcon}><step.icon size={24} strokeWidth={1.7} aria-hidden="true" /></span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                  <span className={styles.stepDetail}><Check size={14} aria-hidden="true" /> {step.detail}</span>
                </div>
              </li>)}
            </ol>
          </div>
        </section>

        <section className={styles.quoteSection} aria-labelledby="quote-heading">
          <div className={`container ${styles.quoteLayout}`}>
            <div className={styles.quotePreview} data-reveal>
              <div className={styles.previewTop}><span className={styles.previewBrand}>M<span>.</span></span><span>ILLUSTRATIVE QUOTE LAYOUT</span></div>
              <div className={styles.previewContent}>
                <p className={styles.previewEyebrow}>YOUR ACCOMMODATION OPTIONS</p>
                <h3>A clearer way to decide.</h3>
                <div className={styles.previewRoute}><span>Makkah</span><span className={styles.previewLine} /><span>Madinah</span></div>
                <div className={styles.previewOption}>
                  <div className={styles.previewOptionHead}><span>OPTION DETAILS</span><span className={styles.previewTag}>FOR YOUR REVIEW</span></div>
                  <div className={styles.previewRow}><MapPin size={17} aria-hidden="true" /><span>Location and distance</span><span className={styles.previewPill} /></div>
                  <div className={styles.previewRow}><UsersRound size={17} aria-hidden="true" /><span>Room and meal plan</span><span className={styles.previewPill} /></div>
                  <div className={styles.previewRow}><CalendarDays size={17} aria-hidden="true" /><span>Dates and terms</span><span className={styles.previewPill} /></div>
                  <div className={styles.previewPrice}><span>FINAL CUSTOMER PRICE</span><strong>Shared in your quote</strong></div>
                </div>
                <p className={styles.previewFootnote}>This is a layout preview. Hotel options and prices are checked for each request.</p>
              </div>
            </div>
            <div className={styles.quoteCopy}>
              <p className={styles.kicker}>WHAT YOU RECEIVE</p>
              <h2 id="quote-heading">The details you need.<br /><em>None of the guesswork.</em></h2>
              <p className={styles.quoteLead}>Your private quote brings the key details together so you can compare what genuinely matters to your trip.</p>
              <div className={styles.quoteDetails}>{quoteDetails.map(item => <div key={item.label} className={styles.quoteDetail}><span><item.icon size={19} strokeWidth={1.7} aria-hidden="true" /></span><div><strong>{item.label}</strong><small>{item.note}</small></div></div>)}</div>
              <p className={styles.quoteNote}><ShieldCheck size={17} aria-hidden="true" /> Options and prices are subject to supplier confirmation until your booking is arranged.</p>
            </div>
          </div>
        </section>

        <section className={styles.clarity} aria-labelledby="clarity-heading">
          <div className={`container ${styles.clarityLayout}`}>
            <div><p className={styles.kicker}>GOOD TO KNOW</p><h2 id="clarity-heading">Clear from the start.</h2><p>We want you to understand exactly what happens before you share your travel details.</p></div>
            <div className={styles.clarityItems}>
              <details><summary>Are hotel options shown live?<span>+</span></summary><p>No. Our team checks availability and prices after you send your request, then shares suitable options with you.</p></details>
              <details><summary>When is my stay confirmed?<span>+</span></summary><p>A quote is a proposal. Your stay is confirmed only after the manual booking process is completed and confirmation details are shared with you.</p></details>
              <details><summary>Can I ask for Makkah and Madinah together?<span>+</span></summary><p>Yes. You can choose multiple destinations and enter separate travel dates for each one in the request form.</p></details>
            </div>
          </div>
        </section>

      </div>
    </PublicShell>
  );
}
