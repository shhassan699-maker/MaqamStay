"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        element.animate(
          [{ opacity: 0.7, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 650, easing: "cubic-bezier(.22, 1, .36, 1)" },
        );
        observer.unobserve(element);
      }
    }, { threshold: 0.12 });

    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
