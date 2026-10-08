import { request } from "node:http";

// Node 24 fetch drops a custom Host header. Core HTTP preserves it for vhost
// probes, while the connection target is restricted to literal loopback.
export async function loopbackResponse(
  value,
  { method = "GET", headers = {}, body, timeout = 15000 } = {},
) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("Only literal HTTP loopback probe targets are allowed");
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, (res) => {
      const chunks = [];
      let size = 0;
      res.on("error", reject);
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024)
          req.destroy(new Error("Probe response exceeds limit"));
        else chunks.push(chunk);
      });
      res.on("end", () => {
        const responseHeaders = new Headers();
        for (let n = 0; n < res.rawHeaders.length; n += 2)
          responseHeaders.append(res.rawHeaders[n], res.rawHeaders[n + 1]);
        resolve(
          new Response(
            method === "HEAD" || [204, 205, 304].includes(res.statusCode)
              ? null
              : Buffer.concat(chunks),
            {
              status: res.statusCode,
              headers: responseHeaders,
            },
          ),
        );
      });
    });
    req.setTimeout(timeout, () =>
      req.destroy(new Error("Loopback probe timeout")),
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}
