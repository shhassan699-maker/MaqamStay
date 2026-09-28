import { NextRequest, NextResponse } from "next/server";
export function proxy(request:NextRequest){if(request.nextUrl.pathname.startsWith("/admin")&&!request.nextUrl.pathname.startsWith("/admin/login")&&!request.cookies.has("maqamstay_admin")){const url=new URL("/admin/login",request.url);return NextResponse.redirect(url)}return NextResponse.next()}
export const config={matcher:["/admin/:path*"]};
