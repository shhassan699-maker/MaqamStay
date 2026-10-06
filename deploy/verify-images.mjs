// Isolated GitHub-hosted runner only; never run against a live Docker daemon.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import assert from "node:assert/strict";
if (process.env.GITHUB_ACTIONS !== "true" || process.env.CI !== "true")
  throw new Error(
    "Image verification requires an isolated GitHub Actions runner",
  );
const [customer, release] = process.argv.slice(2);
assert(customer && release);
const prefix = "maqamstay-customer-ci-" + randomBytes(6).toString("hex");
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
    assert.equal(config.Config.User, "node");
    assert(!JSON.stringify(config).includes(canary));
    assert(
      !(config.Config.Env || []).some((v) =>
        /^(DATABASE_URL|SESSION_SECRET|INVENTORY_CATALOG_API_KEY)=/.test(v),
      ),
    );
    assert(
      !docker(
        "history",
        "--no-trunc",
        "--format",
        "{{json .}}",
        image,
      ).includes(canary),
    );
    docker(
      "run",
      "--rm",
      "--entrypoint",
      "node",
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
    release,
    "--import",
    "tsx",
    "-e",
    "require('@prisma/client');require('bcryptjs');require('fs').accessSync('node_modules/prisma/build/index.js');",
  );
  docker(
    "run",
    "--rm",
    "--entrypoint",
    "node",
    customer,
    "-e",
    "const f=require('fs'),p=require('path');f.mkdirSync('.next/cache',{recursive:true});f.writeFileSync('.next/cache/ci-write-check','ok');function scan(d){for(const e of f.readdirSync(d,{withFileTypes:true})){const n=p.join(d,e.name);if(e.isDirectory())scan(n);else if(/\\.(js|map)$/.test(e.name)&&/DATABASE_URL|SESSION_SECRET|INVENTORY_CATALOG_API_KEY/.test(f.readFileSync(n,'utf8')))throw Error('Server field in browser assets')}}scan('.next/static');",
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
  docker(
    "run",
    "-d",
    "--name",
    prefix,
    "--env-file",
    envFile,
    "-p",
    "127.0.0.1:13000:3000",
    customer,
  );
  await wait("http://127.0.0.1:13000/");
  const config = JSON.parse(docker("inspect", prefix))[0];
  assert.equal(config.NetworkSettings.Ports["3000/tcp"][0].HostIp, "127.0.0.1");
  console.log(
    "Customer/release images: non-root, tooling, cache/tmp writes, loopback health, HTTPS configuration and secret scans PASS",
  );
} finally {
  try {
    docker("rm", "-f", prefix);
  } catch {
    /* Retry probes or clean up only this job's disposable containers. */
  }
  assert.equal(dirname(resolve(folder)), resolve(tmpdir()));
  await rm(folder, { recursive: true, force: true });
}
