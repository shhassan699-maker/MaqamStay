import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ScrollMotion } from "@/components/scroll-motion";
export function PublicShell({ children, showFloatingWhatsApp = true }: { children: React.ReactNode; showFloatingWhatsApp?: boolean }) { return <><SiteHeader/><ScrollMotion/><main>{children}</main><SiteFooter showFloatingWhatsApp={showFloatingWhatsApp}/></>; }
