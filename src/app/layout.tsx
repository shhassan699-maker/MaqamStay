import type { Metadata } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./editorial.css";
import "./location-autocomplete.css";
import "./stitch.css";
import { AnalyticsProvider } from "@/components/analytics-provider";
const displayFont = Newsreader({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const bodyFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"), title: "MaqamStay | Saudi Accommodation Assistance", description: "Tell us your Saudi travel plans. We'll help you find the right place to stay." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const schema = {"@context":"https://schema.org","@type":"WebSite",name:"MaqamStay",url:site,description:"Assisted Saudi accommodation search and booking coordination"};

  // Browser extensions can add attributes to either root element before hydration.
  return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
    <body className={`${displayFont.variable} ${bodyFont.variable}`} suppressHydrationWarning>
      {children}
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}}/>
      <AnalyticsProvider/>
    </body>
  </html>;
}
