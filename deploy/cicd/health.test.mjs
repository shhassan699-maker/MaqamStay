import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inventoryApiHealth } from "./host.mjs";

const api = "https://maqamstay-api.169-58-95-12.sslip.io";
// Approved catalog ingress denies protected GETs with 404 and non-GETs with
// 405. Upstream ServiceGuard rejects a missing catalog credential with 401.
const expected = [
  ["http://127.0.0.1:4000/health/live", 200, "GET"],
  ["http://127.0.0.1:4000/health/ready", 200, "GET"],
  [api + "/api/v1/public/hotels", 401, "GET"],
  [api + "/health/live", 404, "GET"],
  [api + "/health/ready", 404, "GET"],
  [api + "/docs", 404, "GET"],
  [api + "/docs-json", 404, "GET"],
  [api + "/api/v1/admin/hotels", 404, "GET"],
  [api + "/api/v1/auth/me", 404, "GET"],
  [api + "/api/v1/auth/login", 404, "GET"],
  [api + "/api/v1/public/hotels", 405, "POST"],
  [api + "/api/v1/public/hotels", 405, "PUT"],
  [api + "/api/v1/public/hotels", 405, "PATCH"],
  [api + "/api/v1/public/hotels", 405, "DELETE"],
];
function fixture(change = () => undefined) {
  const calls = [];
  const check = async (url, status, headers, validate, method) => {
    const index = calls.length;
    calls.push([url, status, method]);
    assert.deepEqual(headers, {}); // No authentication/cookies/secret headers.
    assert.equal(validate("HTTP/2 " + status + "\r\n"), true);
    assert.equal(
      validate(
        "HTTP/2 " + status + "\r\nLocation: https://login.example.test/\r\n",
      ),
      false,
    );
    const actual = change(index) ?? expected[index][1];
    return actual === status;
  };
  return { calls, check };
}
test("Inventory accepts private health 200, public catalog 401 and exact ingress denials without credentials", async () => {
  const f = fixture();
  assert.equal(await inventoryApiHealth(f.check), true);
  assert.deepEqual(f.calls, expected);
});
for (const [index, [url, status, method]] of expected.entries()) {
  test(`${method} ${url}: failure blocks deployment acceptance`, async () => {
    const f = fixture((i) => (i === index ? 503 : undefined));
    assert.equal(await inventoryApiHealth(f.check), false);
    assert.equal(f.calls.length, index + 1);
    assert.equal(f.calls.at(-1)[1], status);
  });
}
test("public exposure, disabled catalog authentication, wrong ingress route and forwarded writes fail closed", async () => {
  for (const [index, status] of [
    [2, 200], // Credential-free catalog data must never satisfy acceptance.
    [2, 404], // A catch-all denial is not a reachable catalog route.
    [2, 403], // Require the tested ServiceGuard response, not an arbitrary 4xx.
    [3, 200],
    [4, 200],
    [5, 200],
    [7, 401], // Reaching the upstream admin/auth guard means ingress leaked.
    [8, 401],
    [10, 404], // A missing upstream handler does not prove ingress method denial.
    [10, 401],
    [10, 200],
  ]) {
    const f = fixture((i) => (i === index ? status : undefined));
    assert.equal(await inventoryApiHealth(f.check), false);
  }
  await assert.rejects(
    inventoryApiHealth(async () => {
      throw new Error("Simulated transport failure");
    }),
  );
});
test("normal and rollback host health share the policy, Admin stays HTTPS 200, curl ignores implicit credentials", () => {
  const host = readFileSync("deploy/cicd/host.mjs", "utf8");
  assert(host.includes("inventoryApiHealth(probe, definition.health)"));
  assert(host.includes('await probe(ADMIN + "/login")'));
  assert(
    host.includes('await probe(definition.health.localAdminOrigin + "/login")'),
  );
  assert(host.includes('run("/usr/bin/curl", [\n      "--disable"'));
  assert(!host.includes('await probe(API + "/health/live")'));
  assert(!host.includes('await probe(API + "/health/ready")'));
});
