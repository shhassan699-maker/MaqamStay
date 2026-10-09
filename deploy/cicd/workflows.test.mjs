import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const pipeline = yaml.load(
  readFileSync(".github/workflows/publish-images.yml", "utf8"),
);
const ci = yaml.load(readFileSync(".github/workflows/ci.yml", "utf8"));
test("YAML: only staging pushes deploy; pull requests and reusable CI cannot deploy", () => {
  assert.deepEqual(pipeline.on, { push: { branches: ["staging"] } });
  assert(Object.hasOwn(ci.on, "pull_request"));
  assert.deepEqual(ci.on.push.branches, ["staging"]);
  assert.deepEqual(pipeline.jobs.publish.needs, "verify");
  assert.deepEqual(pipeline.jobs.deploy.needs, ["verify", "publish"]);
  assert.equal(pipeline.jobs.deploy.environment, "staging");
  assert.equal(pipeline.concurrency["cancel-in-progress"], false);
  assert.deepEqual(pipeline.jobs.publish.permissions, {
    contents: "read",
    packages: "write",
  });
  assert.deepEqual(pipeline.jobs.deploy.permissions, { contents: "read" });
  assert(!Object.values(ci.jobs).some((job) => job.environment));
});
test("actions are immutable, CI audits all production severities, and publication consumes no application/SSH secrets", () => {
  for (const job of Object.values(pipeline.jobs))
    for (const step of job.steps ?? []) {
      if (step.uses) assert(/@[a-f0-9]{40}$/.test(step.uses));
    }
  const steps = Object.values(ci.jobs).flatMap((job) => job.steps);
  assert(steps.some((step) => step.run === "npm audit --omit=dev"));
  assert(!JSON.stringify(steps).includes("secrets."));
  const publisher = JSON.stringify(pipeline.jobs.publish);
  assert(
    !/STAGING_VPS_|DATABASE_URL|SESSION_SECRET|MONGODB_URI|CATALOG_API_KEY/.test(
      publisher,
    ),
  );
  // Live application secrets are VPS-only in every job, including deployment.
  // CI integration tests generate their own disposable credentials locally.
  assert(
    !/DATABASE_URL|MONGODB_URI|SESSION_SECRET|CATALOG_API_KEY|catalog\.read|STORAGE_(?:ACCESS|SECRET)_KEY|AWS_(?:SECRET_ACCESS|ACCESS)_KEY/.test(
      JSON.stringify([ci, pipeline]),
    ),
  );
  const allowedSecrets = new Set([
    "GITHUB_TOKEN",
    "STAGING_VPS_HOST",
    "STAGING_VPS_USER",
    "STAGING_VPS_SSH_KEY",
    "STAGING_VPS_KNOWN_HOSTS",
  ]);
  for (const [, name] of JSON.stringify([ci, pipeline]).matchAll(
    /secrets\.([A-Za-z0-9_]+)/g,
  ))
    assert(allowedSecrets.has(name), "Unapproved workflow secret reference");
  const builds = pipeline.jobs.publish.steps.filter((step) =>
    step.uses?.startsWith("docker/build-push-action"),
  );
  assert.equal(builds.length, 2);
  for (const build of builds) {
    assert(build.with.tags.endsWith(":${{ github.sha }}"));
    assert.equal(build.with.platforms, "linux/amd64");
    assert(build.if.includes("!= 'true'"));
  }
});
const bash = process.env.CI_TEST_BASH || "bash";
const pathForBash = (path) =>
  path
    .replaceAll("\\", "/")
    .replace(/^([A-Za-z]):\//, (_match, drive) => `/${drive.toLowerCase()}/`);
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
function shell(script, args, env = {}) {
  return spawnSync(bash, [pathForBash(resolve(script)), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}
test("shell parsers reject command injection and invalid requests before any SSH or Docker operation", () => {
  const rootLogin = shell(
    "deploy/cicd/ssh-deploy.sh",
    [
      "customer",
      "a".repeat(40),
      "sha256:" + "b".repeat(64),
      "sha256:" + "c".repeat(64),
    ],
    {
      STAGING_VPS_HOST: "fixture.example",
      STAGING_VPS_USER: "root",
    },
  );
  assert.ifError(rootLogin.error);
  assert.equal(rootLogin.status, 64);
  for (const script of ["ssh-deploy.sh", "entry.sh"]) {
    for (const args of [
      [],
      [
        "customer; id",
        "a".repeat(40),
        "sha256:" + "b".repeat(64),
        "sha256:" + "c".repeat(64),
      ],
      ["customer", "short", "latest", "latest"],
    ]) {
      const result = shell("deploy/cicd/" + script, args);
      assert.ifError(result.error);
      assert.equal(result.status, 64, result.stderr);
    }
  }
  for (const original of [
    "id",
    "deploy customer $(id) x y",
    "validate unknown " + "a".repeat(40),
    "validate customer short",
    "validate customer $(id)",
    "validate customer " + "a".repeat(40) + " customer",
    "validate inventory " + "a".repeat(40) + " /tmp/compose.yml",
    "validate customer " + "a".repeat(40) + "; id",
    "deploy inventory " +
      "a".repeat(40) +
      " sha256:" +
      "b".repeat(64) +
      " sha256:" +
      "c".repeat(64) +
      "; id",
  ]) {
    const result = shell("deploy/cicd/ssh-dispatch.sh", [], {
      SSH_ORIGINAL_COMMAND: original,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 64);
  }
});
test("registry tags are reused, missing manifests permit builds, auth/network errors fail closed", () => {
  const folder = mkdtempSync(join(tmpdir(), "maqamstay-registry-"));
  try {
    const stub = join(folder, "docker");
    const output = join(folder, "output");
    const digest = "sha256:" + "b".repeat(64);
    writeFileSync(
      stub,
      `#!/usr/bin/env bash\ncase "$TEST_MODE" in\nexists) printf '%s\\n' '{"digest":"${digest}"}' ;;\nmissing) echo 'manifest unknown' >&2; exit 1 ;;\nauth) echo 'unauthorized' >&2; exit 1 ;;\nnetwork) echo 'connection timed out' >&2; exit 1 ;;\nbad) echo '{"digest":"latest"}' ;;\nesac\n`,
    );
    chmodSync(stub, 0o755);
    for (const [mode, expected] of [
      ["exists", 0],
      ["missing", 0],
      ["auth", 1],
      ["network", 1],
      ["bad", 1],
    ]) {
      writeFileSync(output, "");
      const result = spawnSync(
        bash,
        [
          "-c",
          `export PATH=${quote(pathForBash(folder))}:"$PATH"; bash ${quote(pathForBash(resolve("deploy/cicd/existing-image.sh")))} maqamstay-customer ${"a".repeat(40)}`,
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            TEST_MODE: mode,
            GITHUB_OUTPUT: pathForBash(output),
          },
        },
      );
      assert.ifError(result.error);
      assert.equal(result.status, expected, result.stderr);
      if (mode === "exists")
        assert.equal(
          readFileSync(output, "utf8"),
          `exists=true\ndigest=${digest}\n`,
        );
      if (mode === "missing")
        assert.equal(readFileSync(output, "utf8"), "exists=false\n");
      if (expected) assert.equal(readFileSync(output, "utf8"), "");
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
test("host operations explicitly exclude dependencies/builds and preserve the media bind", () => {
  const host = readFileSync("deploy/cicd/host.mjs", "utf8");
  assert(host.includes('"--no-deps"'));
  assert(host.includes('"--no-build"'));
  assert(host.includes('"--force-recreate"'));
  assert(host.includes("12 * 1024 ** 3"));
  assert(host.includes("definition.media?.hostPath"));
  const definition = JSON.parse(
    readFileSync("deploy/cicd/cicd.example.json", "utf8"),
  ).deployments.inventory;
  assert.equal(definition.media.hostPath, "/opt/maqamstay-staging/data/media");
  assert(
    !/\bprune\b|['"]down['"]|syncIndexes|migrate reset|nginx.*reload/.test(
      host,
    ),
  );
  assert(host.includes("CONFIRM_ENVIRONMENT") === false); // Fixed by the reviewed release Compose service.
  const entry = readFileSync("deploy/cicd/entry.sh", "utf8");
  assert(entry.includes("/var/lib/maqamstay-cicd/deploy.lock"));
  assert(entry.includes("--exclusive"));
  assert(entry.includes('exec 9< "$lock"'));
  assert(entry.includes("9<&-"));
});
