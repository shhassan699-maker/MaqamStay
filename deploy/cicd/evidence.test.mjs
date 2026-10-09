import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { request, images, services } from "./deployment.mjs";
const commit = "a".repeat(40);
const digest = "sha256:" + "b".repeat(64);
for (const app of ["customer", "inventory"]) {
  test(`${app}: evidence ties both digest outputs to the source commit and gates successful health`, () => {
    const folder = mkdtempSync(join(tmpdir(), "maqamstay-evidence-"));
    const env = {
      ...process.env,
      COMMIT: commit,
      FIRST_DIGEST: digest,
      SECOND_DIGEST: digest,
      GITHUB_STEP_SUMMARY: join(folder, "summary"),
    };
    const invoke = (script) =>
      spawnSync(process.execPath, [resolve("deploy/cicd/" + script), app], {
        cwd: folder,
        env,
        encoding: "utf8",
      });
    try {
      const publication = invoke("image-evidence.mjs");
      assert.equal(publication.status, 0, publication.stderr);
      const record = JSON.parse(
        readFileSync(join(folder, "image-evidence.json"), "utf8"),
      );
      assert.deepEqual(
        record.references,
        request([app, commit, digest, digest]).references,
      );
      assert(record.tags.every((tag) => tag.endsWith(":" + commit)));
      const report = {
        ...record,
        status: "succeeded",
        release: "passed",
        finishedAt: new Date().toISOString(),
        previous: Object.fromEntries(
          services[app].map((service, i) => [
            service,
            `ghcr.io/shhassan699-maker/${images[app][i]}@${digest}`,
          ]),
        ),
        health: Object.fromEntries(
          services[app].map((service) => [service, true]),
        ),
        rollback: {},
      };
      const check = (candidate) => {
        writeFileSync(
          join(folder, "deployment-evidence.json"),
          JSON.stringify(candidate),
        );
        return invoke("check-evidence.mjs").status;
      };
      assert.equal(check(report), 0);
      assert.equal(check({ ...report, commit: "c".repeat(40) }), 1);
      assert.equal(check({ ...report, repository: "other/repository" }), 1);
      assert.equal(
        check({ ...report, status: "failed", rollback: report.previous }),
        1,
      );
      assert.equal(check({ ...report, health: {} }), 1);
      assert.equal(check({ ...report, release: "failed" }), 1);
      assert.equal(check({ ...report, previous: {} }), 1);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
}
