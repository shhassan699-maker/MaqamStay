import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { loopbackResponse } from "./loopback-http.mjs";
const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("loopback probes preserve Host under Node 24 and never follow redirects", async () => {
  const server = createServer((req, res) => {
    assert.equal(req.headers.host, "crm.example.test");
    res.writeHead(307, { Location: "https://example.test/admin" });
    res.end();
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    const response = await loopbackResponse(
      `http://127.0.0.1:${server.address().port}/admin`,
      { headers: { Host: "crm.example.test" } },
    );
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://example.test/admin",
    );
    await assert.rejects(loopbackResponse("http://example.test/"), /loopback/);
  } finally {
    await new Promise((done) => server.close(done));
  }
});

test("Customer Nginx template separates both hosts on one upstream", () => {
  const template = read("nginx/customer-crm.conf.template");
  const servers = template.split(/\nserver \{/).slice(1);
  assert.equal(servers.length, 3);
  const [, publicHost, crmHost] = servers;
  assert.match(
    publicHost,
    /server_name maqamstay-staging\.169-58-95-12\.sslip\.io;/,
  );
  assert.match(crmHost, /server_name maqamstay-crm\.169-58-95-12\.sslip\.io;/);
  for (const path of ["/admin", "/admin/"])
    assert(
      publicHost.includes(
        `${path} { include /etc/nginx/maqamstay/customer-admin-redirect.inc; }`,
      ),
    );
  for (const path of ["/api/admin", "/api/admin/"])
    assert(publicHost.includes(`${path} { return 404; }`));
  for (const path of [
    "/admin",
    "/admin/",
    "/api/admin",
    "/api/admin/",
    "/_next/static/",
    "/_next/image",
    "/brand-mark.svg",
    "/favicon.ico",
    "/icon.svg",
  ])
    assert(
      crmHost.includes(
        `${path} { include /etc/nginx/maqamstay/customer-proxy.inc; }`,
      ),
    );
  assert(crmHost.includes("location / { return 404; }"));
  assert(
    !template.includes("inventory-api") &&
      !template.includes("3100") &&
      !template.includes("4000"),
  );
  assert.match(
    read("nginx/customer-admin-redirect.inc"),
    /sslip\.io\$request_uri;/,
  );
  assert.match(
    read("nginx/customer-proxy.inc"),
    /proxy_pass http:\/\/127\.0\.0\.1:3000;/,
  );
  assert.match(
    read("nginx/customer-proxy.inc"),
    /proxy_set_header Host \$host;/,
  );
});

test("Customer health check preserves loopback binding and sends configured public Host", () => {
  const config = require("js-yaml").load(read("docker-compose.staging.yml"));
  const command = config.services.customer.healthcheck.test.at(-1);
  assert.match(command, /127\.0\.0\.1:3000/);
  assert.match(
    command,
    /Host:new URL\(process\.env\.NEXT_PUBLIC_SITE_URL\)\.host/,
  );
  assert.deepEqual(config.services.customer.ports, ["127.0.0.1:3000:3000"]);
  assert.equal(config.services.postgres.ports, undefined);
  assert.match(read("../next.config.ts"), /skipTrailingSlashRedirect: true/);
});

test("Login, logout and quote links stay on their intended host", () => {
  assert.match(
    read("../src/components/admin-login.tsx"),
    /router\.replace\("\/admin"\)/,
  );
  assert.match(
    read("../src/components/logout-button.tsx"),
    /router\.replace\("\/admin\/login"\)/,
  );
  const detail = read("../src/app/admin/(protected)/requests/[id]/page.tsx");
  assert(
    detail.includes(
      'process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000"',
    ),
  );
  assert(!detail.includes("CUSTOMER_CRM_ORIGIN"));
});
