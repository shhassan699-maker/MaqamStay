import Image from "next/image";
import Link from "next/link";

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return <Link href="/" className={`ms-brand${inverse ? " ms-brand-inverse" : ""}${compact ? " ms-brand-compact" : ""}`} aria-label="MaqamStay home">
    <Image src="/brand-mark.svg" width={42} height={42} alt="" aria-hidden="true" />
    <span className="ms-brand-text"><strong>Maqam<span>Stay</span></strong><small>SAUDI STAY ASSISTANCE</small></span>
  </Link>;
}
