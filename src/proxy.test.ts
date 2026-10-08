import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { customerHosts } from "./lib/customer-hosts";
const publicOrigin = "https://maqamstay-staging.169-58-95-12.sslip.io";
const crmOrigin = "https://maqamstay-crm.169-58-95-12.sslip.io";
const request = (
  origin: string,
  path: string,
  cookie = false,
  method = "GET",
) =>
  new NextRequest(origin + path, {
    method,
    headers: {
      host: new URL(origin).host,
      ...(cookie ? { cookie: `maqamstay_admin=${"a".repeat(64)}` } : {}),
    },
  });
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicOrigin);
  vi.stubEnv("CUSTOMER_CRM_ORIGIN", crmOrigin);
});
afterEach(() => vi.unstubAllEnvs());
describe("Customer/CRM hostname boundaries", () => {
  it.each([
    "/",
    "/hotels",
    "/request",
    "/quote/example",
    "/api/requests",
    "/api/quotes/example/interest",
    "/api/catalog/media/example",
  ])("preserves public route %s", (path) => {
    expect(
      proxy(request(publicOrigin, path)).headers.get("x-middleware-next"),
    ).toBe("1");
  });
  it.each([
    "/admin",
    "/admin/login",
    "/admin/",
    "/admin/requests/example?status=NEW&page=2",
  ])("redirects public admin page %s with path/query intact", (path) => {
    const response = proxy(request(publicOrigin, path, true));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(crmOrigin + path);
  });
  it.each([
    "/api/admin",
    "/api/admin/",
    "/api/admin/login",
    "/api/admin/logout",
    "/api/admin/requests/example",
    "/api/admin/bookings",
    "/api/admin/quotes",
    "/api/admin/reviews",
  ])("blocks public admin API %s without a redirect", (path) => {
    for (const method of ["GET", "POST", "PATCH"]) {
      const response = proxy(request(publicOrigin, path, true, method));
      expect(response.status).toBe(404);
      expect(response.headers.has("location")).toBe(false);
    }
  });
  it("does not redirect POST bodies on public admin pages", () => {
    expect(proxy(request(publicOrigin, "/admin", false, "POST")).status).toBe(
      405,
    );
  });
  it("permits CRM login without a session", () => {
    expect(
      proxy(request(crmOrigin, "/admin/login")).headers.get(
        "x-middleware-next",
      ),
    ).toBe("1");
  });
  it.each([
    "/admin",
    "/admin/requests",
    "/admin/bookings",
    "/admin/commissions",
  ])("retains authenticated fixture path %s on CRM", (path) => {
    expect(
      proxy(request(crmOrigin, path, true)).headers.get("x-middleware-next"),
    ).toBe("1");
    expect(proxy(request(crmOrigin, path)).headers.get("location")).toBe(
      crmOrigin + "/admin/login",
    );
  });
  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Fbrand-mark.svg&w=48&q=75",
    "/brand-mark.svg",
    "/favicon.ico",
    "/icon.svg",
    "/api/admin/login",
  ])("permits CRM asset/admin API %s", (path) => {
    expect(
      proxy(request(crmOrigin, path)).headers.get("x-middleware-next"),
    ).toBe("1");
  });
  it.each([
    "/hotels",
    "/request",
    "/quote/example",
    "/api/requests",
    "/api/quotes/example/interest",
    "/api/catalog/media/example",
    "/api/locations/cities",
    "/api/administer",
  ])("does not expose public route %s on CRM", (path) => {
    expect(proxy(request(crmOrigin, path, true)).status).toBe(404);
  });
  it("rejects unknown hosts and ignores spoofed forwarding headers", () => {
    const req = request("https://untrusted.example.test", "/admin");
    req.headers.set("x-forwarded-host", new URL(crmOrigin).host);
    expect(proxy(req).status).toBe(404);
  });
  it("redirects CRM root within CRM", () => {
    expect(proxy(request(crmOrigin, "/")).headers.get("location")).toBe(
      crmOrigin + "/admin",
    );
  });
  it.each([
    undefined,
    publicOrigin,
    "http://crm.example.test",
    crmOrigin + "/",
    "https://user:password@crm.example.test",
  ])("fails closed for missing/unsafe production CRM origin %#", (origin) => {
    vi.stubEnv("CUSTOMER_CRM_ORIGIN", origin);
    expect(proxy(request(publicOrigin, "/admin")).status).toBe(503);
  });
  it("preserves single-host local development without a CRM setting", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("CUSTOMER_CRM_ORIGIN", undefined);
    expect(customerHosts().crmOrigin).toBe("http://localhost:3000");
    expect(proxy(request("http://localhost:3000", "/request")).status).toBe(
      200,
    );
  });
});
