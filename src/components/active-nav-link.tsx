"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ActiveNavLink({ href, children, exact = false, className }: { href: string; children: ReactNode; exact?: boolean; className?: string }) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && href !== "/" && pathname.startsWith(`${href}/`));

  return <Link href={href} className={className} aria-current={active ? "page" : undefined}>{children}</Link>;
}
