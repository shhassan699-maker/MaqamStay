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
  verificationArguments,
  fixtureNetworkArgs,
  assertFixtureNetwork,
  fixtureEgressSource,
  cleanupFixtures,
  ownershipLabel,
  assertCommittedSourceEntries,
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

test("Linux mode is deliberate and rejects every remote endpoint before daemon access", () => {
  assert.deepEqual(verificationArguments(["--mode", "linux", "/inventory"]), {
    mode: "linux",
    positional: ["/inventory"],
  });
  assert.throws(() => verificationArguments(["--mode"]));
  assert.throws(() => verificationArguments(["--unrecognized"]));
  const unix = (args) =>
    args[0] === "info"
      ? JSON.stringify({ OSType: "linux" })
      : JSON.stringify([
          { Endpoints: { docker: { Host: "unix:///var/run/docker.sock" } } },
        ]);
  assert(
    assertVerificationTarget({
      mode: "linux",
      platform: "linux",
      env: {},
      run: unix,
    }),
  );
  assert.throws(() =>
    assertVerificationTarget({ platform: "linux", env: {}, run: unix }),
  );
  assert.throws(() =>
    assertVerificationTarget({
      mode: "linux",
      platform: "win32",
      env: {},
      run: unix,
    }),
  );
  for (const host of [
    "ssh://root@example.test",
    "tcp://127.0.0.1:2375",
    "tcp://example.test:2376",
  ]) {
    let daemonCalls = 0;
    const run = (args) => {
      if (args[0] === "info") daemonCalls++;
      return JSON.stringify([{ Endpoints: { docker: { Host: host } } }]);
    };
    assert.throws(() =>
      assertVerificationTarget({
        mode: "linux",
        platform: "linux",
        env: {},
        run,
      }),
    );
    assert.equal(daemonCalls, 0);
  }
});

test("committed exports reject local secrets, dependencies, artifacts and nested Inventory", () => {
  assertCommittedSourceEntries(
    ["src/app/page.tsx", ".env.example", ".env.staging.example"],
    { customer: true },
  );
  for (const path of [
    ".env",
    "apps/api/.env.local",
    "node_modules/next/package.json",
    "apps/admin/node_modules/next/package.json",
    "apps/admin/.next/cache/file",
    "dist/apps/api.js",
    ".local/database-tools/tool.exe",
    "test-results/screenshot.png",
    "private.key",
    "backup.bson.gz",
    "maqamstay-inventory-admin/package.json",
  ])
    assert.throws(() =>
      assertCommittedSourceEntries([path], { customer: true }),
    );
  assert.throws(() => assertCommittedSourceEntries([]));
});

test("Docker 29 fixture network uses an owned normal bridge and rejects internal networks", () => {
  const owner = "maqamstay-fixture-123";
  const args = fixtureNetworkArgs(owner + "-network", owner);
  assert(!args.includes("--internal"));
  assert(args.includes("bridge"));
  const network = {
    Driver: "bridge",
    Internal: false,
    Labels: { [ownershipLabel]: owner },
  };
  assertFixtureNetwork(network, owner);
  assert.throws(() =>
    assertFixtureNetwork({ ...network, Internal: true }, owner),
  );
  assert.throws(() => assertFixtureNetwork({ ...network, Labels: {} }, owner));
  const publicPort = {
    NetworkSettings: {
      Ports: { "4000/tcp": [{ HostIp: "0.0.0.0", HostPort: "14000" }] },
    },
  };
  assert.throws(() => assertPublishedPorts(publicPort, { "4000/tcp": 14000 }));
});

test("fixture egress guard blocks external sockets/DNS and permits loopback HTTP", () => {
  const folder = mkdtempSync(join(tmpdir(), "maqamstay-egress-test-"));
  const guard = join(folder, "guard.cjs");
  try {
    writeFileSync(guard, fixtureEgressSource({ "inventory-api": "127.0.0.1" }));
    const source = `const a=require('node:assert/strict'),net=require('node:net'),dns=require('node:dns'),http=require('node:http');
      a.throws(()=>net.connect(443,'example.com'),/prohibited/);
      a.throws(()=>net.connect({host:'169.254.169.254',port:80}),/prohibited/);
      a.throws(()=>net.connect({host:'8.8.8.8',port:53}),/prohibited/);
      (async()=>{ await a.rejects(dns.promises.lookup('example.com'),/prohibited/);
        a.equal((await dns.promises.lookup('inventory-api-staging.maqamstay.com')).address,'127.0.0.1');
        a.throws(()=>net.connect({host:'0.0.0.0',port:80}),/prohibited/);
        const server=http.createServer((q,r)=>r.end('ok')).listen(0,'0.0.0.0',async()=>{
          try { a.equal(await (await fetch('http://inventory-api:'+server.address().port)).text(),'ok');console.log('guard PASS'); }
          finally {server.close();} });
      })().catch(()=>process.exit(1));`;
    assert.match(
      execFileSync(process.execPath, ["--require", guard, "-e", source], {
        stdio: "pipe",
        timeout: 10000,
      }).toString(),
      /guard PASS/,
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cleanup removes only owned exact resources, includes anonymous volumes and reports failures", () => {
  const owner = "maqamstay-fixture-123";
  const calls = [];
  const docker = (...args) => {
    calls.push(args);
    if (args.includes("inspect"))
      return JSON.stringify([
        {
          Name: args[0] === "container" ? "/" + owner : owner + "-network",
          Config: { Labels: { [ownershipLabel]: owner } },
          Labels: { [ownershipLabel]: owner },
        },
      ]);
    if (args[0] === "ps" || args[1] === "ls") return "owned-id";
    return "";
  };
  cleanupFixtures(docker, {
    names: [owner],
    network: owner + "-network",
    owner,
  });
  assert(calls.some((args) => args.join(" ") === "rm -f -v owned-id"));
  assert(
    calls
      .filter((args) => args.includes("--filter"))
      .every((args) => args.includes(`label=${ownershipLabel}=${owner}`)),
  );
  assert.throws(() =>
    cleanupFixtures(
      (...args) =>
        args.includes("inspect")
          ? JSON.stringify([{ Name: "/unrelated", Config: { Labels: {} } }])
          : "id",
      { names: [owner], network: owner + "-network", owner },
    ),
  );
});
