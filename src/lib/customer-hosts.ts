import { z } from "zod";

export const originSchema = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value;
}, "Use an exact HTTP(S) origin without credentials, path or trailing slash");

export function customerHosts() {
  const publicOrigin = originSchema.parse(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );
  const configuredCrm = process.env.CUSTOMER_CRM_ORIGIN;
  if (process.env.NODE_ENV === "production" && !configuredCrm)
    throw new Error("CUSTOMER_CRM_ORIGIN is required in production");
  const crmOrigin = originSchema.parse(configuredCrm || publicOrigin);
  if (
    process.env.NODE_ENV === "production" &&
    (!publicOrigin.startsWith("https://") ||
      !crmOrigin.startsWith("https://") ||
      crmOrigin === publicOrigin)
  )
    throw new Error(
      "Production requires separate HTTPS Customer and CRM origins",
    );
  return {
    publicOrigin,
    crmOrigin,
    publicHost: new URL(publicOrigin).host,
    crmHost: new URL(crmOrigin).host,
  };
}
export function isAdminPage(path: string) {
  return path === "/admin" || path.startsWith("/admin/");
}
export function isAdminApi(path: string) {
  return path === "/api/admin" || path.startsWith("/api/admin/");
}
export function isCrmAsset(path: string) {
  return (
    path.startsWith("/_next/static/") ||
    path === "/_next/image" ||
    ["/brand-mark.svg", "/favicon.ico", "/icon.svg"].includes(path)
  );
}
export function isCrmHost(host: string | null) {
  return host?.toLowerCase() === customerHosts().crmHost;
}
export function allowedOrigin(
  origin: string | null,
  host: string | null,
  audience: "public" | "crm",
) {
  const configured = customerHosts();
  const expected =
    audience === "crm" ? configured.crmOrigin : configured.publicOrigin;
  return origin === expected && host?.toLowerCase() === new URL(expected).host;
}
