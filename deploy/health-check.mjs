// Read-only loopback checks. Does not print response bodies or credentials.
import { loopbackResponse } from "./loopback-http.mjs";
const probes = [
  ["customer", "http://127.0.0.1:3000/"],
  ["admin", "http://127.0.0.1:3100/login"],
  ["api-live", "http://127.0.0.1:4000/health/live"],
  ["api-ready", "http://127.0.0.1:4000/health/ready"],
];
for (const [name, url] of probes) {
  try {
    const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    if (name === "customer" && !publicOrigin)
      throw new Error("Set NEXT_PUBLIC_SITE_URL to the image's public origin");
    const response = await loopbackResponse(url, {
      ...(name === "customer"
        ? { headers: { Host: new URL(publicOrigin).host } }
        : {}),
      timeout: 10000,
    });
    const ok = response.status === 200;
    console.log(`${name}: ${ok ? "PASS" : "FAIL"} (${response.status})`);
    if (!ok) process.exitCode = 1;
    await response.body?.cancel();
  } catch {
    console.log(`${name}: FAIL (connection/timeout)`);
    process.exitCode = 1;
  }
}
