import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export const secretNames =
  "DATABASE_URL|SESSION_SECRET|INVENTORY_CATALOG_API_KEY|MONGODB_URI|STORAGE_SECRET_KEY|STORAGE_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|ADMIN_PASSWORD";

// Inspect the selected endpoint before any daemon request. Never switch contexts.
export function assertVerificationTarget({
  local = false,
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
  if (local) {
    assert.equal(
      platform,
      "win32",
      "Local mode supports Windows Docker Desktop only",
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
    assert.equal(platform, "linux", "Use --local for Windows Docker Desktop");
    assert(
      env.GITHUB_ACTIONS === "true" &&
        env.CI === "true" &&
        env.RUNNER_ENVIRONMENT === "github-hosted",
      "Requires an isolated GitHub-hosted runner or explicit --local mode",
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
  if (local) assert.match(server.OperatingSystem, /Docker Desktop/i);
  return true;
}

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
