// Disposable verification on GitHub-hosted Linux or explicit Windows Desktop mode.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import assert from "node:assert/strict";
import {
  assertVerificationTarget,
  assertImageSecrets,
  assertPublishedPorts,
  browserCheckSource,
} from "./image-verification.mjs";
const local = process.argv.includes("--local");
assertVerificationTarget({ local });
const [customer, release] = process.argv
  .slice(2)
  .filter((value) => value !== "--local");
assert(customer && release);
const prefix = "maqamstay-customer-ci-" + randomBytes(6).toString("hex");
const network = prefix + "-network";
const folder = await mkdtemp(join(tmpdir(), prefix));
const canary = (await readFile(".env.image-ci", "utf8")).trim();
function docker(...args) {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error("Isolated Docker check failed; command output withheld");
  }
}
async function wait(url) {
  for (let n = 0; n < 90; n++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      await r.body?.cancel();
      if (r.status === 200) return;
    } catch {
      /* Retry probes or clean up only this job's disposable containers. */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Customer HTTP health check failed");
}
try {
  for (const image of [customer, release]) {
    const config = JSON.parse(docker("image", "inspect", image))[0];
    assertImageSecrets(
      config,
      docker("history", "--no-trunc", "--format", "{{json .}}", image),
      canary,
    );
    docker(
      "run",
      "--rm",
      "--entrypoint",
      "node",
      "--network",
      "none",
      image,
      "-e",
      "const fs=require('fs'),a=require('assert');a(process.getuid()!==0);a(!fs.existsSync('/app/.env.image-ci'));a(!fs.existsSync('/app/.env'));fs.writeFileSync('/tmp/write-check','ok');",
    );
  }
  docker(
    "run",
    "--rm",
    "--entrypoint",
    "node",
    "--network",
    "none",
    release,
    "-e",
    "const f=require('fs'),a=require('assert');require('@prisma/client');require('bcryptjs');f.accessSync('node_modules/prisma/build/index.js');f.accessSync('scripts/create-admin.mjs');a(!f.existsSync('node_modules/eslint'));",
  );
  const prismaVersion = docker(
    "run",
    "--rm",
    "--entrypoint",
    "node",
    "--network",
    "none",
    release,
    "node_modules/prisma/build/index.js",
    "--version",
  );
  assert(prismaVersion.includes("Schema Engine"));
  assert(!/could not|unknown|not found/i.test(prismaVersion));
  assert.match(docker("run", "--rm", "--network", "none", release), /^v24\./);
  assert.equal(
    Object.keys(
      JSON.parse(docker("image", "inspect", release))[0].Config.ExposedPorts ||
        {},
    ).length,
    0,
  );
  docker(
    "run",
    "--rm",
    "--entrypoint",
    "node",
    "--network",
    "none",
    customer,
    "-e",
    browserCheckSource({
      staticPath: ".next/static",
      cachePath: ".next/cache",
      canary,
    }),
  );
  const envFile = join(folder, "runtime.env");
  await writeFile(
    envFile,
    "NODE_ENV=production\nNEXT_PUBLIC_SITE_URL=https://staging.maqamstay.com\nNEXT_PUBLIC_WHATSAPP_NUMBER=10000000000\n" +
      "SESSION_SECRET=" +
      randomBytes(32).toString("hex") +
      "\n" +
      "INVENTORY_API_URL=https://inventory-api-staging.maqamstay.com\nINVENTORY_TIMEOUT_MS=5000\n" +
      "INVENTORY_CATALOG_API_KEY=ci-only-unused-" +
      randomBytes(24).toString("hex") +
      "\n",
    { mode: 0o600 },
  );
  // Preserve HTTPS configuration without allowing external runtime requests.
  docker("network", "create", "--internal", network);
  docker(
    "run",
    "-d",
    "--name",
    prefix,
    "--network",
    network,
    "--env-file",
    envFile,
    "-p",
    "127.0.0.1:13000:3000",
    customer,
  );
  await wait("http://127.0.0.1:13000/");
  const config = JSON.parse(docker("inspect", prefix))[0];
  assertPublishedPorts(config, { "3000/tcp": 13000 });
  console.log(
    "Customer/release images: non-root, tooling, cache/tmp writes, loopback health, HTTPS configuration and secret scans PASS",
  );
} finally {
  try {
    docker("rm", "-f", prefix);
  } catch {
    /* Retry probes or clean up only this job's disposable containers. */
  }
  try {
    docker("network", "rm", network);
  } catch {
    /* Cleanup only this run's network. */
  }
  assert.equal(dirname(resolve(folder)), resolve(tmpdir()));
  await rm(folder, { recursive: true, force: true });
}
