// Exercises the production build over loopback. No database/provider connections.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm, symlink, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { loopbackResponse } from "./loopback-http.mjs";
const publicOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://maqamstay-staging.169-58-95-12.sslip.io";
const crmOrigin = "https://maqamstay-crm.169-58-95-12.sslip.io";
const password = randomBytes(24).toString("hex");
const temp = await mkdtemp(join(tmpdir(), "maqamstay-crm-fixture-"));
const fixturePath = join(temp, "prisma-fixture.cjs");
const listener = createServer();
await new Promise((done, reject) => {
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", done);
});
const port = listener.address().port;
await new Promise((done) => listener.close(done));
let server;
let probes = 0;
try {
  // Next loads dotenv files from its cwd. Use an isolated cwd containing only
  // the built app/assets/dependencies and configuration, never a local .env.
  for (const name of [".next", "public", "node_modules"])
    await symlink(
      resolve(name),
      join(temp, name),
      process.platform === "win32" ? "junction" : "dir",
    );
  for (const name of ["package.json", "next.config.ts"])
    await copyFile(resolve(name), join(temp, name));
  await writeFile(
    fixturePath,
    `
const Module = require('node:module');
const original = Module._load;
const bcrypt = original.call(Module, ${JSON.stringify(resolve("node_modules/bcryptjs"))}, module, false);
const hash = bcrypt.hashSync(process.env.CRM_FIXTURE_PASSWORD, 4);
const sessions = new Map();
const admin = {id:'fixture',name:'QA Operator',email:'qa@example.test',active:true,passwordHash:hash};
Module._load = function(id, ...args) {
  const value = original.call(this, id, ...args);
  // Turbopack external packages can carry a generated hash suffix.
  if (id !== '@prisma/client' && !id.startsWith('@prisma/client-')) return value;
  return {...value, PrismaClient: class {
    constructor() {
      this.adminUser = {findUnique: async () => admin};
      this.adminSession = {
        create: async ({data}) => {sessions.set(data.tokenHash, {...data,admin});return data},
        findUnique: async ({where}) => sessions.get(where.tokenHash) || null,
        deleteMany: async ({where}) => {if(where.tokenHash)sessions.delete(where.tokenHash);return {count:1}}
      };
      this.rateLimit = {upsert:async()=>({count:1,windowStart:new Date()}),update:async()=>({})};
      for(const name of ['accommodationRequest','booking','review'])
        this[name] = {findMany:async()=>[],count:async()=>0,groupBy:async()=>[]};
    }
  }};
};
`,
    { mode: 0o600 },
  );
  // Inherit platform process-launch settings only. Never inherit runtime secrets.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|LOCALAPPDATA|APPDATA|PATHEXT)$/i.test(
        key,
      ),
    ),
  );
  Object.assign(env, {
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SITE_URL: publicOrigin,
    CUSTOMER_CRM_ORIGIN: crmOrigin,
    NEXT_PUBLIC_WHATSAPP_NUMBER: "10000000000",
    DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/customer_test",
    SESSION_SECRET: randomBytes(32).toString("hex"),
    INVENTORY_API_URL: "https://127.0.0.1:1",
    INVENTORY_TIMEOUT_MS: "5000",
    INVENTORY_CATALOG_API_KEY: randomBytes(32).toString("hex"),
    CRM_FIXTURE_PASSWORD: password,
  });
  server = spawn(
    process.execPath,
    [
      "--require",
      fixturePath,
      resolve("node_modules/next/dist/bin/next"),
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    {
      env,
      cwd: temp,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let launchError;
  let serverLog = "";
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => {
      serverLog = (serverLog + chunk.toString()).slice(-4000);
    });
  let lastStatus;
  server.on("error", (error) => {
    launchError = error;
  });
  async function request(
    origin,
    path,
    { method = "GET", cookie, sentOrigin, body } = {},
  ) {
    return loopbackResponse(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        Host: new URL(origin).host,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(sentOrigin ? { Origin: sentOrigin } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (launchError || server.exitCode !== null)
      throw new Error("Fixture server failed to start");
    try {
      const response = await request(crmOrigin, "/admin/login");
      await response.body?.cancel();
      lastStatus = response.status;
      ready = response.status === 200;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 500));
  }
  if (!ready) {
    for (const value of [
      password,
      env.SESSION_SECRET,
      env.INVENTORY_CATALOG_API_KEY,
      env.DATABASE_URL,
    ])
      serverLog = serverLog.split(value).join("[test value redacted]");
    console.error("Fixture readiness status:", lastStatus, serverLog);
  }
  assert(
    ready,
    "Fixture server did not become ready; build with the selected public origin",
  );
  async function check(origin, path, status, options = {}, location) {
    const response = await request(origin, path, options);
    assert.equal(response.status, status, `${new URL(origin).host}${path}`);
    if (location) assert.equal(response.headers.get("location"), location);
    if (status === 404) assert.equal(response.headers.get("location"), null);
    await response.body?.cancel();
    probes++;
  }
  for (const path of ["/", "/hotels", "/request"])
    await check(publicOrigin, path, 200);
  for (const path of [
    "/admin",
    "/admin/login",
    "/admin/",
    "/admin/requests/example?status=NEW&page=2",
  ])
    await check(publicOrigin, path, 307, {}, crmOrigin + path);
  for (const path of [
    "/api/admin",
    "/api/admin/",
    "/api/admin/login",
    "/api/admin/requests/example",
    "/api/admin/bookings",
  ])
    for (const method of ["GET", "POST"])
      await check(publicOrigin, path, 404, { method });
  for (const path of [
    "/hotels",
    "/request",
    "/api/requests",
    "/api/quotes/example/interest",
    "/api/catalog/media/example",
  ])
    await check(crmOrigin, path, 404);
  await check("https://untrusted.example.test", "/admin/login", 404);
  const login = await request(crmOrigin, "/api/admin/login", {
    method: "POST",
    sentOrigin: crmOrigin,
    body: { email: "qa@example.test", password },
  });
  if (login.status !== 200) {
    for (const value of [
      password,
      env.SESSION_SECRET,
      env.INVENTORY_CATALOG_API_KEY,
      env.DATABASE_URL,
    ])
      serverLog = serverLog.split(value).join("[test value redacted]");
    console.error(serverLog);
  }
  assert.equal(login.status, 200, "CRM fixture login");
  const cookieHeader = login.headers.get("set-cookie");
  assert(
    cookieHeader &&
      /HttpOnly/i.test(cookieHeader) &&
      /Secure/i.test(cookieHeader) &&
      /SameSite=Lax/i.test(cookieHeader),
  );
  assert(!/Domain=/i.test(cookieHeader), "Cookie must remain host-only");
  const cookie = cookieHeader.split(";")[0];
  await login.body?.cancel();
  probes++;
  for (const path of [
    "/admin",
    "/admin/requests",
    "/admin/bookings",
    "/admin/commissions",
  ])
    await check(crmOrigin, path, 200, { cookie });
  // Valid session/CRM Origin reaches payload validation (400), without writing
  // a booking. Other origins fail at the real guard before payload handling.
  await check(crmOrigin, "/api/admin/bookings", 400, {
    method: "POST",
    cookie,
    sentOrigin: crmOrigin,
    body: {},
  });
  for (const sentOrigin of [publicOrigin, "https://untrusted.example.test"])
    await check(crmOrigin, "/api/admin/bookings", 403, {
      method: "POST",
      cookie,
      sentOrigin,
      body: {},
    });
  await check(crmOrigin, "/api/admin/bookings", 401, {
    method: "POST",
    sentOrigin: crmOrigin,
    body: {},
  });
  const loginPage = await request(crmOrigin, "/admin/login");
  const html = await loginPage.text();
  const asset = html.match(/src="([^"\s]*\/_next\/static\/[^"\s]+\.js)"/);
  assert(asset, "Login must have Next runtime assets");
  await check(crmOrigin, asset[1].replace(/&amp;/g, "&"), 200);
  await check(crmOrigin, "/icon.svg", 200);
  for (const sentOrigin of [publicOrigin, "https://untrusted.example.test"])
    await check(crmOrigin, "/api/admin/logout", 403, {
      method: "POST",
      cookie,
      sentOrigin,
    });
  const logout = await request(crmOrigin, "/api/admin/logout", {
    method: "POST",
    cookie,
    sentOrigin: crmOrigin,
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);
  assert(!/Domain=/i.test(logout.headers.get("set-cookie")));
  await logout.body?.cancel();
  probes++;
  await check(crmOrigin, "/admin", 307, { cookie }, "/admin/login");
  console.log(
    `Customer/CRM production HTTP: ${probes} checks PASS; fixture login, authenticated pages, host-only Secure/HttpOnly/Lax cookie, logout and assets PASS`,
  );
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise((done) => server.once("exit", done));
    server.kill();
    await exited;
  }
  assert.equal(dirname(resolve(temp)), resolve(tmpdir()));
  assert(temp.split(/[\\/]/).at(-1).startsWith("maqamstay-crm-fixture-"));
  await rm(temp, { recursive: true, force: true });
}
