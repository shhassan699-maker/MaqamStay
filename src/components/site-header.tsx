import { ArrowUpRight, Menu, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { ActiveNavLink } from "@/components/active-nav-link";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { whatsappUrl } from "@/lib/whatsapp";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/makkah", label: "Makkah" },
  { href: "/madinah", label: "Madinah" },
  { href: "/jeddah", label: "Jeddah" },
  { href: "/riyadh", label: "Riyadh" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  return <>
    <div className="ms-topbar"><div className="container"><span><ShieldCheck size={13} /> Assisted Saudi accommodation planning</span><span>Availability is checked after you send your request</span></div></div>
    <header className="site-header ms-header"><div className="container ms-header-row">
      <Brand />
      <nav className="ms-desktop-nav" aria-label="Main navigation">{navigation.map(item => <ActiveNavLink href={item.href} key={item.href}>{item.label}</ActiveNavLink>)}</nav>
      <div className="ms-header-actions">
        <a className="ms-support-link" href={whatsappUrl("Assalamualaikum, I'd like help planning my Saudi stay.")} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={18} /> WhatsApp help</a>
        <ActiveNavLink href="/request" className="button button-primary ms-header-cta">Find me a hotel <ArrowUpRight size={17} /></ActiveNavLink>
      </div>
      <details className="ms-mobile-nav"><summary aria-label="Open navigation menu"><Menu size={25} /></summary><nav aria-label="Mobile navigation">{navigation.map(item => <ActiveNavLink href={item.href} key={item.href}>{item.label}</ActiveNavLink>)}<ActiveNavLink href="/request" className="ms-mobile-cta">Find me a hotel <ArrowUpRight size={16}/></ActiveNavLink><a className="ms-mobile-whatsapp" href={whatsappUrl("Assalamualaikum, I'd like help planning my Saudi stay.")} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={18}/> Chat on WhatsApp</a></nav></details>
    </div></header>
  </>;
}
