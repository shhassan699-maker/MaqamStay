import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export const secretNames =
  "DATABASE_URL|SESSION_SECRET|INVENTORY_CATALOG_API_KEY|MONGODB_URI|STORAGE_SECRET_KEY|STORAGE_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|ADMIN_PASSWORD";

// Inspect the selected endpoint before any daemon request. Never switch contexts.
export function assertVerificationTarget({
  local = false,
  mode = local ? "windows" : "ci",
  platform = process.platform,
  env = process.env,
  run = (args) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim(),
} = {}) {
  assert(
    !env.DOCKER_HOST && !env.DOCKER_CONTEXT,
    "Unset Docker endpoint overrides before verification",
  );
  assert(
    !env.BUILDX_BUILDER,
    "Unset the Buildx builder override before verification",
  );
  assert(
    ["windows", "linux", "ci"].includes(mode),
    "Unknown verification mode",
  );
  if (mode === "windows") {
    assert.equal(
      platform,
      "win32",
      "Windows mode requires Windows Docker Desktop",
    );
    assert.equal(
      run(["context", "show"]),
      "desktop-linux",
      "Select the local desktop-linux context manually",
    );
    const context = JSON.parse(run(["context", "inspect", "desktop-linux"]))[0];
    assert.equal(
      context.Endpoints.docker.Host.toLowerCase(),
      "npipe:////./pipe/dockerdesktoplinuxengine",
      "Remote Docker endpoints are prohibited",
    );
  } else {
    assert.equal(platform, "linux", "Linux verification requires a Linux host");
    if (mode === "ci")
      assert(
        env.GITHUB_ACTIONS === "true" &&
          env.CI === "true" &&
          env.RUNNER_ENVIRONMENT === "github-hosted",
        "Use explicit --mode linux outside GitHub-hosted CI",
      );
    const context = JSON.parse(run(["context", "inspect"]))[0];
    assert.equal(
      context.Endpoints.docker.Host,
      "unix:///var/run/docker.sock",
      "Remote Docker endpoints are prohibited",
    );
  }
  const server = JSON.parse(run(["info", "--format", "{{json .}}"]));
  assert.equal(server.OSType, "linux", "Linux containers are required");
  if (mode === "windows")
    assert.match(server.OperatingSystem, /Docker Desktop/i);
  return true;
}

export function verificationArguments(args, defaultMode = "ci") {
  let mode = defaultMode;
  const positional = [];
  for (let n = 0; n < args.length; n++) {
    if (args[n] === "--mode") {
      mode = args[++n];
      assert(
        ["windows", "linux", "ci"].includes(mode),
        "Expected --mode windows, linux or ci",
      );
    } else if (args[n] === "--local") mode = "windows";
    else {
      assert(!args[n].startsWith("--"), "Unknown verification argument");
      positional.push(args[n]);
    }
  }
  return { mode, positional };
}

export const ownershipLabel = "com.maqamstay.image-verification";

export function assertCommittedSourceEntries(paths, { customer = false } = {}) {
  assert(paths.length > 0, "Empty committed source export");
  for (const path of paths) {
    const parts = path.split("/");
    assert(
      !parts.some((part) =>
        [
          "node_modules",
          ".next",
          ".git",
          ".local",
          ".storage",
          "dist",
          "coverage",
          "test-results",
          "playwright-report",
        ].includes(part),
      ),
      "Dependency/build/test artifact in committed source",
    );
    const file = parts.at(-1);
    assert(
      !file.startsWith(".env") ||
        [".env.example", ".env.staging.example"].includes(file),
      "Non-template environment file in committed source",
    );
    assert(
      !/\.(pem|key|p12|pfx|bson|dump|archive)(?:\.gz)?$/i.test(file),
      "Credential/database artifact in committed source",
    );
    if (customer)
      assert(
        parts[0] !== "maqamstay-inventory-admin",
        "Nested Inventory checkout in customer source export",
      );
  }
}

// A normal bridge preserves Docker 29 loopback publishing. Node fixtures additionally
// reject every dependency connection except their exact generated endpoints.
export function fixtureNetworkArgs(name, owner) {
  assert.match(name, /^maqamstay-[a-z0-9-]+$/);
  assert.match(owner, /^maqamstay-[a-z0-9-]+$/);
  return [
    "network",
    "create",
    "--driver",
    "bridge",
    "--label",
    `${ownershipLabel}=${owner}`,
    name,
  ];
}

export function assertFixtureNetwork(network, owner) {
  assert.equal(network.Driver, "bridge");
  assert.equal(network.Internal, false);
  assert.equal(network.Labels?.[ownershipLabel], owner);
}

export function cleanupFixtures(docker, { names, network, owner }) {
  const errors = [];
  for (const [kind, name] of [
    ...[...names].reverse().map((name) => ["container", name]),
    ["network", network],
  ]) {
    try {
      const ids = docker(
        kind === "container" ? "ps" : "network",
        ...(kind === "container" ? ["-aq"] : ["ls", "-q"]),
        "--filter",
        `label=${ownershipLabel}=${owner}`,
        "--filter",
        `name=${name}`,
      )
        .split(/\s+/)
        .filter(Boolean);
      for (const id of ids) {
        const info = JSON.parse(docker(kind, "inspect", id))[0];
        assert.equal(info.Name, kind === "container" ? "/" + name : name);
        assert.equal(
          (kind === "container" ? info.Config.Labels : info.Labels)?.[
            ownershipLabel
          ],
          owner,
        );
        if (kind === "container") docker("rm", "-f", "-v", id);
        else docker("network", "rm", id);
      }
    } catch (error) {
      errors.push(error);
    }
  }
  assert.equal(
    errors.length,
    0,
    "Task-owned resource cleanup failed; inspect only this verification's labels",
  );
}

export function installFixtureEgressGuard(hosts, load) {
  const net = load("node:net");
  const dns = load("node:dns");
  const allowed = new Set([
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    ...Object.values(hosts),
  ]);
  for (const ip of allowed)
    if (!net.isIP(ip))
      throw new Error("Fixture guard requires literal IP endpoints");
  function target(host) {
    const address = hosts[host] || host;
    if (!allowed.has(address))
      throw new Error("External fixture dependency connection prohibited");
    return address;
  }
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const normalized = Array.isArray(args[0]) ? args[0] : args;
    const options =
      typeof normalized[0] === "object"
        ? { ...normalized[0] }
        : {
            port: normalized[0],
            host:
              typeof normalized[1] === "string" ? normalized[1] : "127.0.0.1",
          };
    if (options.path)
      throw new Error("Fixture Unix socket connection prohibited");
    options.host = target(options.host || "127.0.0.1");
    const callback = normalized.find((arg) => typeof arg === "function");
    return callback
      ? connect.call(this, options, callback)
      : connect.call(this, options);
  };
  const lookup = function (host, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    try {
      // Wildcard literals are needed for server.listen; Socket.connect still rejects them.
      const address = host === "0.0.0.0" || host === "::" ? host : target(host);
      const family = net.isIP(address);
      const result = options?.all ? [{ address, family }] : address;
      process.nextTick(() => callback(null, result, family));
    } catch (error) {
      process.nextTick(() => callback(error));
    }
  };
  dns.lookup = lookup;
  dns.promises.lookup = (host, options) =>
    new Promise((resolve, reject) =>
      lookup(host, options || {}, (error, address, family) =>
        error
          ? reject(error)
          : resolve(options?.all ? address : { address, family }),
      ),
    );
}

export function fixtureEgressSource(hosts = {}) {
  return `(${installFixtureEgressGuard.toString()})(${JSON.stringify({ localhost: "127.0.0.1", "inventory-api-staging.maqamstay.com": "127.0.0.1", ...hosts })}, require);`;
}

export const fixtureGuardCheckSource = `const a=require('node:assert/strict'),net=require('node:net'),dns=require('node:dns');
a.throws(()=>net.connect({host:'169.254.169.254',port:80}),/prohibited/);
a.throws(()=>net.connect({host:'example.com',port:443}),/prohibited/);
dns.promises.lookup('example.com').then(()=>process.exit(1),()=>console.log('External fixture endpoints blocked'));`;

export function assertImageSecrets(config, history, canary) {
  assert.equal(config.Config.User, "node");
  assert(canary.length >= 32, "Generated build canary required");
  assert(!JSON.stringify(config).includes(canary));
  assert(!history.includes(canary));
  const binding = new RegExp("^(?:" + secretNames + ")=");
  assert(
    !(config.Config.Env || []).some((value) => binding.test(value)),
    "Runtime secret baked into image environment",
  );
  assert(
    !new RegExp("\\b(?:" + secretNames + ")=[^\\s]+").test(history),
    "Secret binding in image history",
  );
}

export function assertPublishedPorts(container, expected) {
  const actual = Object.fromEntries(
    Object.entries(container.NetworkSettings.Ports || {}).filter(
      ([, bindings]) => bindings?.length,
    ),
  );
  assert.deepEqual(
    Object.keys(actual).sort(),
    Object.keys(expected).sort(),
    "Unexpected host port publication",
  );
  for (const [port, published] of Object.entries(expected)) {
    assert.deepEqual(actual[port], [
      { HostIp: "127.0.0.1", HostPort: String(published) },
    ]);
  }
}

// Serialize this function itself for docker exec: no hand-escaped regex inside strings.
export function checkBrowserAssets(
  { staticPath, cachePath, forbidden, canary },
  load,
) {
  const fs = load("node:fs");
  const path = load("node:path");
  const assert = load("node:assert/strict");
  const pattern = new RegExp(forbidden);
  if (cachePath) {
    fs.mkdirSync(cachePath, { recursive: true });
    fs.writeFileSync(path.join(cachePath, "verification-write"), "ok");
  }
  let count = 0;
  function visit(folder) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name);
      if (item.isDirectory()) visit(file);
      else if (/\.(js|map)$/.test(item.name)) {
        const data = fs.readFileSync(file, "utf8");
        assert(!pattern.test(data), "Server configuration in browser asset");
        assert(!data.includes(canary), "Build canary in browser asset");
        count++;
      }
    }
  }
  visit(staticPath);
  assert(count > 0, "No browser assets inspected");
  console.log(`Browser assets inspected: ${count}`);
}

export function browserCheckSource(options) {
  return `(${checkBrowserAssets.toString()})(${JSON.stringify({ forbidden: secretNames, ...options })}, require)`;
}
