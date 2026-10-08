import { NextRequest, NextResponse } from "next/server";
import {
  customerHosts,
  isAdminApi,
  isAdminPage,
  isCrmAsset,
} from "@/lib/customer-hosts";

export function proxy(request: NextRequest) {
  let hosts: ReturnType<typeof customerHosts>;
  try {
    hosts = customerHosts();
  } catch {
    return NextResponse.json(
      { error: "Service configuration unavailable" },
      { status: 503 },
    );
  }
  // Ignore client-supplied forwarding headers. Trusted ingress must preserve Host.
  const host = request.headers.get("host")?.toLowerCase();
  const path = request.nextUrl.pathname;
  const crm = host === hosts.crmHost;
  if (!crm && host !== hosts.publicHost)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isAdminApi(path) && !crm)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isAdminPage(path) && !crm) {
    if (!["GET", "HEAD"].includes(request.method))
      return new NextResponse(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    const target = new URL(hosts.crmOrigin);
    target.pathname = path;
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 307);
  }
  if (crm && hosts.crmHost !== hosts.publicHost) {
    if (path === "/") {
      if (!["GET", "HEAD"].includes(request.method))
        return new NextResponse(null, {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        });
      return NextResponse.redirect(new URL("/admin", hosts.crmOrigin), 307);
    }
    if (!isAdminPage(path) && !isAdminApi(path) && !isCrmAsset(path))
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    isAdminPage(path) &&
    path !== "/admin/login" &&
    !request.cookies.has("maqamstay_admin")
  )
    return NextResponse.redirect(new URL("/admin/login", hosts.crmOrigin), 307);
  return NextResponse.next();
}

// Include assets so the CRM allowlist applies to every request.
export const config = { matcher: ["/:path*"] };
