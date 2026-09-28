import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { whatsappUrl } from "@/lib/whatsapp";

const helpMessage = "Assalamualaikum, I'd like help finding accommodation in Saudi Arabia.";

export function SiteFooter({ showFloatingWhatsApp = true }: { showFloatingWhatsApp?: boolean }) {
  return <>
    <footer className="site-footer ms-footer">
      <div className="container">
        <div className="ms-footer-lead">
          <div>
            <span className="ms-footer-eyebrow">YOUR SAUDI STAY STARTS HERE</span>
            <h2>Tell us where you&apos;re going. <em>We&apos;ll help with the stay.</em></h2>
            <p>Share your travel plans and our team will help you compare suitable accommodation options.</p>
          </div>
          <div className="ms-footer-lead-actions">
            <Link href="/request" className="ms-footer-primary">Find me a hotel <ArrowUpRight size={18} aria-hidden="true" /></Link>
            <a href={whatsappUrl(helpMessage)} target="_blank" rel="noopener noreferrer" className="ms-footer-secondary"><WhatsAppIcon size={20} /> Chat on WhatsApp</a>
          </div>
        </div>

        <div className="ms-footer-grid">
          <div className="ms-footer-intro">
            <Brand inverse />
            <p>Thoughtful accommodation assistance for your Saudi journey, from the first request to the next step.</p>
            <span className="ms-footer-service"><ShieldCheck size={15} aria-hidden="true" /> Personal assistance, clear options</span>
          </div>
          <nav aria-label="Footer destinations">
            <h3>Destinations</h3>
            <Link href="/makkah">Makkah</Link>
            <Link href="/madinah">Madinah</Link>
            <Link href="/jeddah">Jeddah</Link>
            <Link href="/riyadh">Riyadh</Link>
          </nav>
          <nav aria-label="Footer site links">
            <h3>Explore</h3>
            <Link href="/">Home</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/request">Request a stay</Link>
            <Link href="/about">About us</Link>
          </nav>
          <nav aria-label="Footer help and policies">
            <h3>Help &amp; information</h3>
            <Link href="/faq">FAQs</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </nav>
        </div>

        <div className="ms-footer-notice"><ShieldCheck size={19} aria-hidden="true" /><p><strong>How our service works</strong><span>MaqamStay helps you request and compare accommodation options. Availability and final prices are checked after you submit your request; bookings are confirmed manually.</span></p></div>
        <div className="ms-footer-bottom"><span>© {new Date().getFullYear()} MaqamStay. All rights reserved.</span><span>Made for journeys that deserve a little more care.</span></div>
      </div>
    </footer>
    {showFloatingWhatsApp && <a className="floating-whatsapp ms-floating-whatsapp" href={whatsappUrl(helpMessage)} target="_blank" rel="noopener noreferrer" aria-label="Chat with MaqamStay on WhatsApp"><WhatsAppIcon size={26}/><span>WhatsApp help</span></a>}
  </>;
}
