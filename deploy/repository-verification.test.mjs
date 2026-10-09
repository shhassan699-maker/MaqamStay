import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, join, posix } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const semver = require("semver");
const customer = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inventory =
  process.env.INVENTORY_ROOT && resolve(process.env.INVENTORY_ROOT);

for (const [name, root] of [
  ["customer", customer],
  ...(inventory ? [["inventory", inventory]] : []),
]) {
  test(`${name} lock resolves Sharp WASM runtime dependencies without relying on node_modules`, () => {
    const packages = JSON.parse(
      readFileSync(join(root, "package-lock.json"), "utf8"),
    ).packages;
    let checked = 0;
    for (const [owner, entry] of Object.entries(packages)) {
      for (const [dependency, range] of Object.entries({
        ...entry.dependencies,
        ...entry.optionalDependencies,
      })) {
        // npm omits unused workspace WASM subtrees; assert the Sharp runtime
        // edges that caused npm ci to fail, plus Customer's required core entry.
        if (dependency !== "@emnapi/runtime" || !owner.includes("sharp-wasm32"))
          continue;
        let location = owner;
        let resolved;
        while (true) {
          resolved =
            packages[
              (location ? location + "/" : "") + "node_modules/" + dependency
            ];
          if (resolved || !location) break;
          location = posix.dirname(location);
          if (location === ".") location = "";
        }
        assert(resolved, `Missing ${dependency} required by ${owner}`);
        assert(
          semver.satisfies(resolved.version, range),
          `Incorrect ${dependency} version for ${owner}`,
        );
        checked++;
      }
    }
    assert(checked > 0);
    assert.equal(packages["node_modules/@emnapi/runtime"].version, "1.11.3");
    if (name === "customer")
      assert.equal(packages["node_modules/@emnapi/core"].version, "1.11.3");
  });
  test(`${name} Dockerfiles enforce the reviewed Node/npm toolchain`, () => {
    for (const path of name === "customer"
      ? ["deploy/Dockerfile"]
      : ["deploy/admin.Dockerfile", "deploy/api.Dockerfile"]) {
      const source = readFileSync(join(root, path), "utf8");
      assert(source.includes('test "$(node --version)" = "v24.21.0"'));
      assert(source.includes('test "$(npm --version)" = "11.19.0"'));
      assert(
        source.includes(
          "@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20",
        ),
      );
      assert(source.includes("USER node"));
    }
  });
}

test("staging Compose has executable resource limits and private database separation", () => {
  const config = yaml.load(
    readFileSync(join(customer, "deploy/docker-compose.staging.yml"), "utf8"),
  );
  assert.equal(config.services.customer.mem_limit, "768m");
  assert.equal(config.services.customer.cpus, 0.5);
  assert.equal(config.services.postgres.mem_limit, "1g");
  assert.equal(config.services.postgres.cpus, 0.5);
  assert.equal(config.services.postgres.ports, undefined);
  assert.deepEqual(config.services.postgres.networks, ["customer_db"]);
  assert.equal(config.networks.customer_db.internal, true);
  assert.deepEqual(config.services.customer.ports, ["127.0.0.1:3000:3000"]);
  assert.equal(
    config.services.customer.environment.INVENTORY_API_URL,
    undefined,
  );
  if (inventory) {
    const other = yaml.load(
      readFileSync(
        join(inventory, "deploy/docker-compose.staging.yml"),
        "utf8",
      ),
    );
    for (const [service, port] of [
      ["inventory-admin", 3100],
      ["inventory-api", 4000],
    ]) {
      assert.equal(other.services[service].mem_limit, "768m");
      assert.equal(other.services[service].cpus, 0.5);
      assert.deepEqual(other.services[service].networks, ["inventory_app"]);
      assert.deepEqual(other.services[service].ports, [
        `127.0.0.1:${port}:${port}`,
      ]);
    }
    assert.equal(other.services["inventory-api"].read_only, true);
    assert.equal(
      other.services["inventory-admin"].environment.ADMIN_API_ORIGIN,
      "http://inventory-api:4000",
    );
  }
});

test("source bundle scanners fail closed for empty directories, missing paths and source-map leaks", () => {
  const folder = mkdtempSync(join(tmpdir(), "maqamstay-source-scan-"));
  const staticPath = join(folder, "apps/admin/.next/static");
  mkdirSync(staticPath, { recursive: true });
  const run = (script, args = [], cwd = customer) =>
    execFileSync(process.execPath, [script, ...args], {
      cwd,
      stdio: "pipe",
      env: { ...process.env, CUSTOMER_ROOT: folder },
    });
  try {
    if (inventory)
      assert.throws(() =>
        run(join(inventory, "scripts/verify-public-bundles.mjs"), [], folder),
      );
    assert.throws(() =>
      run(join(customer, "deploy/verify-bundles.mjs"), [folder]),
    );
    assert.throws(() =>
      run(join(customer, "deploy/verify-bundles.mjs"), [
        join(folder, "missing"),
      ]),
    );
    writeFileSync(join(staticPath, "asset.js"), "safe");
    writeFileSync(join(staticPath, "asset.map"), "SESSION_SECRET");
    assert.throws(() =>
      run(join(customer, "deploy/verify-bundles.mjs"), [folder]),
    );
    if (inventory) {
      assert.throws(() =>
        run(join(inventory, "scripts/verify-public-bundles.mjs"), [], folder),
      );
      writeFileSync(join(staticPath, "asset.map"), "safe");
      assert.throws(() =>
        run(join(inventory, "scripts/verify-public-bundles.mjs"), [], folder),
      );
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
