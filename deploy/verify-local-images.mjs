// Build and verify committed sources only, on explicitly selected local Docker.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  assertVerificationTarget,
  verificationArguments,
  assertCommittedSourceEntries,
} from "./image-verification.mjs";

if (process.argv.includes("--help")) {
  console.log(
    "node deploy/verify-local-images.mjs [--mode windows|linux] [absolute-inventory-repository-path]\nWindows defaults to local Docker Desktop (desktop-linux). Linux requires --mode linux and a local Unix Docker socket.\nRequires committed, clean repositories. Builds four local images and invokes CI assertions. No publication or deployment.",
  );
  process.exit(0);
}

const customer = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { mode, positional } = verificationArguments(
  process.argv.slice(2),
  "windows",
);
assert(mode !== "ci", "Coordinator requires explicit local verification mode");
assert(
  positional.length <= 1,
  "Expected at most one inventory repository path",
);
const inventory = resolve(
  positional[0] || join(customer, "maqamstay-inventory-admin"),
);
// Whitelist process infrastructure, never inherit application credentials/configuration.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|LANG|LC_ALL|USER|LOGNAME|XDG_RUNTIME_DIR|USERPROFILE|HOME|HOMEDRIVE|HOMEPATH|LOCALAPPDATA|APPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA)$/i.test(
      key,
    ),
  ),
);
function run(command, args, cwd = customer, inherit = false) {
  return execFileSync(command, args, {
    cwd,
    env,
    windowsHide: true,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  })?.trim();
}

// Validate the user's actual selection/overrides before using a sanitized environment.
try {
  assertVerificationTarget({ mode });
} catch {
  throw new Error(
    "Verification requires the selected local Linux engine and no Docker/Buildx endpoint overrides. Windows: desktop-linux; Linux: local /var/run/docker.sock. See docs/image-verification.md.",
  );
}
run("docker", ["buildx", "version"]);
run("docker", ["compose", "version"]);
const commits = {};
for (const [name, source] of [
  ["customer", customer],
  ["inventory", inventory],
]) {
  assert.equal(
    resolve(run("git", ["rev-parse", "--show-toplevel"], source)),
    source,
    "Each source must be its own local Git repository",
  );
  assert.equal(
    run("git", ["status", "--porcelain"], source),
    "",
    "Commit intended changes before verification; do not reset local work",
  );
  commits[name] = run("git", ["rev-parse", "HEAD"], source);
  assertCommittedSourceEntries(
    run("git", ["ls-tree", "-r", "--name-only", "HEAD"], source).split("\n"),
    { customer: name === "customer" },
  );
}

const prefix = "maqamstay-four-image-test-" + randomBytes(6).toString("hex");
const folder = mkdtempSync(join(tmpdir(), prefix));
const roots = {
  customer: join(folder, "customer"),
  inventory: join(folder, "inventory"),
};
const images = [
  "customer",
  "customer-release",
  "inventory-admin",
  "inventory-api",
].map((name) => `local/maqamstay-${name}:${prefix}`);
try {
  for (const [name, source] of [
    ["customer", customer],
    ["inventory", inventory],
  ]) {
    mkdirSync(roots[name]);
    const archive = join(folder, name + ".tar");
    run(
      "git",
      [
        "-c",
        "core.autocrlf=false",
        "archive",
        "--format=tar",
        "--output=" + archive,
        "HEAD",
      ],
      source,
    );
    run("tar", ["-xf", archive, "-C", roots[name]]);
    writeFileSync(
      join(roots[name], ".env.image-ci"),
      "ci-only-canary-" + randomBytes(24).toString("hex"),
    );
  }
  console.log(
    "Building committed customer and inventory sources in secret-free temporary contexts",
  );
  run(
    "docker",
    [
      "build",
      "-f",
      "deploy/Dockerfile",
      "--target",
      "runtime",
      "--build-arg",
      "NEXT_PUBLIC_SITE_URL=https://staging.maqamstay.com",
      "--build-arg",
      "NEXT_PUBLIC_WHATSAPP_NUMBER=10000000000",
      "-t",
      images[0],
      ".",
    ],
    roots.customer,
    true,
  );
  run(
    "docker",
    [
      "build",
      "-f",
      "deploy/Dockerfile",
      "--target",
      "release",
      "-t",
      images[1],
      ".",
    ],
    roots.customer,
    true,
  );
  run(
    "docker",
    [
      "build",
      "-f",
      "deploy/admin.Dockerfile",
      "--build-arg",
      "ADMIN_API_ORIGIN=http://inventory-api:4000",
      "-t",
      images[2],
      ".",
    ],
    roots.inventory,
    true,
  );
  run(
    "docker",
    ["build", "-f", "deploy/api.Dockerfile", "-t", images[3], "."],
    roots.inventory,
    true,
  );
  run(
    process.execPath,
    ["--test", "deploy/image-verification.test.mjs"],
    roots.customer,
    true,
  );
  run(
    process.execPath,
    ["deploy/verify-images.mjs", "--mode", mode, images[0], images[1]],
    roots.customer,
    true,
  );
  // Sibling temporary checkouts match Inventory CI's CUSTOMER_ROOT layout.
  env.CUSTOMER_ROOT = roots.customer;
  run(
    process.execPath,
    ["scripts/verify-images.mjs", "--mode", mode, images[2], images[3]],
    roots.inventory,
    true,
  );
  const report = {
    status: "passed",
    mode,
    customerCommit: commits.customer,
    inventoryCommit: commits.inventory,
    published: false,
    images: images.map((name) => ({
      name,
      localImageId: JSON.parse(
        run("docker", ["image", "inspect", "--format", "{{json .Id}}", name]),
      ),
    })),
  };
  const evidence = join(tmpdir(), prefix + "-evidence.json");
  writeFileSync(evidence, JSON.stringify(report, null, 2) + "\n");
  console.log("Four-image verification PASS. Non-secret evidence: " + evidence);
  console.log(
    "Only newly built local image tags are retained; disposable test containers/networks are removed.",
  );
} finally {
  assert.equal(dirname(resolve(folder)), resolve(tmpdir()));
  rmSync(folder, { recursive: true, force: true });
}
