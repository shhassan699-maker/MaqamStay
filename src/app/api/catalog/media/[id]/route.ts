import "server-only";
import { z } from "zod";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (
    !z
      .string()
      .regex(/^[a-f\d]{24}$/)
      .safeParse(id).success
  )
    return new Response(null, { status: 404 });
  try {
    const base = new URL(process.env.INVENTORY_API_URL || "");
    if (
      base.username ||
      base.password ||
      base.pathname !== "/" ||
      base.search ||
      base.hash ||
      (base.protocol !== "https:" &&
        !(
          base.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(base.hostname)
        ))
    )
      throw new Error("Invalid origin");
    // Fixed, unauthenticated published-image endpoint. No service key, admin paths, or URL passthrough.
    const upstream = await fetch(new URL(`/api/v1/public/media/${id}`, base), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok)
      return new Response(null, {
        status: upstream.status === 404 ? 404 : 503,
      });
    if (upstream.headers.get("content-type") !== "image/webp" || !upstream.body)
      return new Response(null, { status: 503 });
    const reader = upstream.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8 * 1024 * 1024) {
        await reader.cancel();
        return new Response(null, { status: 503 });
      }
      chunks.push(value);
    }
    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
