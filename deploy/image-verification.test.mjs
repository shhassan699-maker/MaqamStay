import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  assertVerificationTarget,
  assertPublishedPorts,
  assertImageSecrets,
  browserCheckSource,
} from "./image-verification.mjs";

test("serialized scanner inspects .js/.map and rejects leaks and empty assets", () => {
  const folder = mkdtempSync(join(tmpdir(), "maqamstay-scanner-test-"));
  const canary = "fixture-canary-value-with-at-least-32-characters";
  const scan = () =>
    execFileSync(
      process.execPath,
      ["-e", browserCheckSource({ staticPath: folder, canary })],
      { stdio: "pipe" },
    );
  try {
    assert.throws(scan);
    writeFileSync(join(folder, "safe.js"), "console.log('safe')");
    assert.match(scan().toString(), /inspected: 1/);
    writeFileSync(join(folder, "leak.js"), "SESSION_SECRET");
    assert.throws(scan);
    writeFileSync(join(folder, "leak.js"), "safe");
    writeFileSync(join(folder, "leak.map"), canary);
    assert.throws(scan);
  } finally {
    assert.equal(dirname(resolve(folder)), resolve(tmpdir()));
    rmSync(folder, { recursive: true, force: true });
  }
});

test("local mode rejects overrides and remote contexts before contacting a daemon", () => {
  let calls = 0;
  const run = (args) => {
    calls++;
    return args[0] === "context" && args[1] === "show"
      ? "desktop-linux"
      : JSON.stringify([
          { Endpoints: { docker: { Host: "ssh://root@example.test" } } },
        ]);
  };
  assert.throws(() =>
    assertVerificationTarget({
      local: true,
      platform: "win32",
      env: { DOCKER_HOST: "tcp://example.test:2375" },
      run,
    }),
  );
  assert.equal(calls, 0);
  assert.throws(() =>
    assertVerificationTarget({ local: true, platform: "win32", env: {}, run }),
  );
  assert.equal(calls, 2);
});

test("Desktop and hosted modes accept only their own Linux engine", () => {
  const run = (args) =>
    args[0] === "info"
      ? JSON.stringify({ OSType: "linux", OperatingSystem: "Docker Desktop" })
      : args[1] === "show"
        ? "desktop-linux"
        : JSON.stringify([
            {
              Endpoints: {
                docker: { Host: "npipe:////./pipe/dockerDesktopLinuxEngine" },
              },
            },
          ]);
  assert(
    assertVerificationTarget({ local: true, platform: "win32", env: {}, run }),
  );
  const hostedRun = (args) =>
    args[0] === "info"
      ? JSON.stringify({ OSType: "linux" })
      : JSON.stringify([
          { Endpoints: { docker: { Host: "unix:///var/run/docker.sock" } } },
        ]);
  assert(
    assertVerificationTarget({
      platform: "linux",
      env: {
        GITHUB_ACTIONS: "true",
        CI: "true",
        RUNNER_ENVIRONMENT: "github-hosted",
      },
      run: hostedRun,
    }),
  );
  assert.throws(() =>
    assertVerificationTarget({
      local: false,
      platform: "win32",
      env: { GITHUB_ACTIONS: "true", CI: "true" },
      run,
    }),
  );
});

test("port and image checks reject extra publications and baked credentials", () => {
  const ports = {
    NetworkSettings: {
      Ports: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "13000" }] },
    },
  };
  assertPublishedPorts(ports, { "3000/tcp": 13000 });
  ports.NetworkSettings.Ports["5432/tcp"] = [
    { HostIp: "0.0.0.0", HostPort: "5432" },
  ];
  assert.throws(() => assertPublishedPorts(ports, { "3000/tcp": 13000 }));
  const config = { Config: { User: "node", Env: ["NODE_ENV=production"] } };
  const canary = "fixture-canary-value-with-at-least-32-characters";
  assertImageSecrets(config, "safe", canary);
  assert.throws(() =>
    assertImageSecrets(config, "SESSION_SECRET=fixture", canary),
  );
  config.Config.Env.push("INVENTORY_CATALOG_API_KEY=fixture");
  assert.throws(() => assertImageSecrets(config, "safe", canary));
});
