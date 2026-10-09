import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request, deploy, images, services, immutable } from "./deployment.mjs";
import { selectors } from "./host.mjs";

const sha = "a".repeat(40);
const digest = "sha256:" + "b".repeat(64);
const oldDigest = "sha256:" + "c".repeat(64);
function fixture(app, failure) {
  const events = [];
  const selected = {};
  const input = request([app, sha, digest, digest]);
  const host = {
    now: () => "2026-10-09T00:00:00Z",
    preflight: async () => {
      events.push("preflight");
      if (failure === "preflight") throw Error();
    },
    previous: async (service) => {
      events.push("previous:" + service);
      const index = services[app].indexOf(service);
      return failure === "mutable"
        ? "local/image:latest"
        : `ghcr.io/shhassan699-maker/${images[app][index]}@${oldDigest}`;
    },
    journal: async (report) => {
      events.push("journal:" + report.status);
    },
    pull: async (ref) => {
      events.push("pull:" + ref);
      if (failure === "pull") throw Error();
    },
    safety: async () => {
      events.push("disk");
      if (failure === "disk") throw Error();
    },
    release: async () => {
      events.push("release");
      if (failure === "release") throw Error();
    },
    select: async (refs) => {
      events.push("select:" + Object.keys(refs).join(","));
      Object.assign(selected, refs);
    },
    recreate: async (service, rollback) => {
      events.push((rollback ? "rollback:" : "up:") + service);
      if (failure === "up:" + service && !rollback) throw Error();
      if (failure === "rollback-up" && rollback) throw Error();
    },
    health: async (service, rollback) => {
      events.push((rollback ? "rollback-health:" : "health:") + service);
      return rollback
        ? failure !== "rollback-health"
        : ![
            "health:" + service,
            "rollback-up",
            "rollback-health",
            "both",
          ].includes(failure);
    },
  };
  return { input, host, events, selected };
}
test("only full SHA and exactly two SHA256 digests enter the deployment protocol", () => {
  assert.equal(request(["customer", sha, digest, digest]).references.length, 2);
  for (const args of [
    ["customer", "abc123", digest, digest],
    ["main", sha, digest, digest],
    ["inventory", sha, "latest", digest],
    ["inventory", sha, digest, digest, digest],
    ["customer;id", sha, digest, digest],
    ["customer", sha, digest + ";id", digest],
  ])
    assert.throws(() => request(args));
  assert(
    !immutable(
      `ghcr.io/other/maqamstay-customer@${digest}`,
      images.customer[0],
    ),
  );
  assert(
    !immutable(
      `ghcr.io/shhassan699-maker/maqamstay-customer@${digest}extra`,
      images.customer[0],
    ),
  );
});
for (const app of ["customer", "inventory"]) {
  test(`${app}: publication digests, checkpoint, release and narrowly scoped recreation`, async () => {
    const f = fixture(app);
    const report = await deploy(f.input, f.host);
    assert.equal(report.status, "succeeded");
    assert.equal(report.release, "passed");
    assert.deepEqual(
      f.events.filter((e) => e.startsWith("up:")),
      services[app].map((s) => "up:" + s),
    );
    assert(f.events.indexOf("journal:failed") < f.events.indexOf("release"));
    assert(f.events.indexOf("disk") < f.events.indexOf("release"));
    assert.equal(Object.keys(report.previous).length, services[app].length);
    assert.deepEqual(report.rollback, {});
  });
  for (const failure of ["preflight", "mutable", "pull", "disk", "release"]) {
    test(`${app}: ${failure} failure never recreates any service`, async () => {
      const f = fixture(app, failure);
      const report = await deploy(f.input, f.host);
      assert.equal(report.status, "failed");
      assert(
        !f.events.some((e) => e.startsWith("up:") || e.startsWith("rollback:")),
      );
    });
  }
  for (const service of services[app]) {
    test(`${app}: unhealthy ${service} restores only its previous immutable image`, async () => {
      const f = fixture(app, "health:" + service);
      const report = await deploy(f.input, f.host);
      assert.equal(report.status, "failed");
      assert.deepEqual(Object.keys(report.rollback), [service]);
      assert.equal(report.rollback[service].healthy, true);
      assert.equal(f.selected[service], report.previous[service]);
      for (const other of services[app].filter((s) => s !== service))
        assert(f.selected[other].endsWith(digest));
    });
    test(`${app}: partially failed recreation of ${service} is rolled back`, async () => {
      const f = fixture(app, "up:" + service);
      const report = await deploy(f.input, f.host);
      assert.equal(report.status, "failed");
      assert.equal(report.rollback[service].healthy, true);
      for (const s of services[app])
        assert.equal(f.selected[s], report.previous[s]);
    });
  }
}
for (const failure of ["both", "rollback-up", "rollback-health"]) {
  test(`inventory: ${failure} retains failure evidence and verifies each rollback separately`, async () => {
    const f = fixture("inventory", failure);
    const report = await deploy(f.input, f.host);
    assert.equal(report.status, "failed");
    assert.equal(Object.keys(report.rollback).length, 2);
    for (const result of Object.values(report.rollback))
      assert.equal(result.healthy, failure === "both");
  });
}
test("legacy locally built applications roll back to the retained immutable Docker image ID", async () => {
  for (const app of ["customer", "inventory"]) {
    const f = fixture(app, "both");
    f.host.previous = async () => oldDigest;
    const report = await deploy(f.input, f.host);
    assert.equal(report.status, "failed");
    for (const service of services[app]) {
      assert.equal(report.previous[service], oldDigest);
      assert.equal(report.rollback[service].reference, oldDigest);
      assert.equal(report.rollback[service].healthy, true);
    }
  }
});
test("atomic image selection preserves unrelated selectors and secret bytes, and rejects ambiguity/injection", async () => {
  const dir = await mkdtemp(join(tmpdir(), "maqamstay-selectors-"));
  try {
    const path = join(dir, "images.env");
    const original = `# untouched\nCUSTOMER_IMAGE=old\nINVENTORY_API_IMAGE=old-api\nCUSTOMER_ENV_FILE=/etc/maqamstay-staging/customer.env\n`;
    await writeFile(path, original);
    const ref = request(["customer", sha, digest, digest]).references[0];
    await selectors(path, { CUSTOMER_IMAGE: ref });
    assert.equal(
      await readFile(path, "utf8"),
      original.replace("CUSTOMER_IMAGE=old", "CUSTOMER_IMAGE=" + ref),
    );
    await assert.rejects(selectors(path, { CUSTOMER_IMAGE: "image:latest" }));
    await assert.rejects(
      selectors(path, { CUSTOMER_IMAGE: ref + "\nEVIL=value" }),
    );
    await assert.rejects(selectors(path, { MISSING: ref }));
    await selectors(path, { CUSTOMER_IMAGE: oldDigest });
    assert(
      (await readFile(path, "utf8")).includes("CUSTOMER_IMAGE=" + oldDigest),
    );
    await writeFile(path, original + "CUSTOMER_IMAGE=duplicate\n");
    await assert.rejects(selectors(path, { CUSTOMER_IMAGE: ref }));
    await writeFile(
      path,
      original + "  export CUSTOMER_IMAGE = hidden-duplicate\n",
    );
    await assert.rejects(selectors(path, { CUSTOMER_IMAGE: ref }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
