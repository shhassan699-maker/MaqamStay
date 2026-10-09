import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  exampleConfiguration,
  configuration,
  selectorSource,
} from "./configuration.mjs";

// Exercise the actual future example's Node body with only simulated I/O.
// The shell example, Docker daemon and VPS are NEVER invoked by these tests.
const body = readFileSync(
  "deploy/cicd/normalize-customer-baseline.example.sh",
  "utf8",
)
  .match(/<<'NODE'\r?\n([\s\S]*?)\r?\nNODE/)?.[1]
  .replace(/^import .*;\r?$/gm, "");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const simulate = new AsyncFunction(
  "api",
  "process",
  `const { readFile, open, chown, chmod, execFile, promisify, protectedPath, privateEnv, atomic, configuration, selectorSource } = api;\n${body}`,
);

async function fixture(fault = "") {
  const def = exampleConfiguration().deployments.customer;
  const runtime = "sha256:" + "a".repeat(64),
    release = "sha256:" + "b".repeat(64);
  let source =
    "CUSTOMER_IMAGE=local/customer:old-tag\nCUSTOMER_RELEASE_IMAGE=local/customer-release:reviewed\n";
  if (fault === "invalid-source")
    source += "OTHER_APPLICATION_IMAGE=unexpected\n";
  const commands = [],
    writes = [],
    output = [];
  const process = {
    stdout: { write: (s) => output.push(s) },
    stderr: { write: (s) => output.push(s) },
    exitCode: 0,
  };
  const api = {
    configuration,
    selectorSource,
    readFile: async (path) =>
      path.endsWith("cicd.json")
        ? JSON.stringify(exampleConfiguration())
        : source,
    privateEnv: async () => {},
    protectedPath: async () => ({ nlink: 1 }),
    open: async (path) => {
      writes.push(["backup", path]);
      return {
        writeFile: async () => {},
        sync: async () => {},
        close: async () => {},
      };
    },
    chown: async (...args) => {
      writes.push(["chown", ...args]);
    },
    chmod: async (...args) => {
      writes.push(["chmod", ...args]);
    },
    atomic: async (path, value) => {
      writes.push(["atomic", path]);
      source = value;
    },
    execFile: () => {
      throw Error("Real process execution forbidden");
    },
    promisify: () => async (bin, args) => {
      assert.equal(bin, "/usr/bin/docker");
      commands.push(args);
      assert(["ps", "inspect", "image"].includes(args[0]));
      if (args[0] === "ps") return { stdout: "c".repeat(64) };
      if (args[0] === "image") {
        if (args.at(-1) === "local/customer-release:reviewed") {
          if (fault === "missing-release") throw Error("Release image missing");
          return { stdout: release };
        }
        assert.equal(args.at(-1), runtime); // Never resolve the mutable runtime tag.
        return { stdout: runtime };
      }
      if (args[2] === "{{.Image}}") return { stdout: runtime };
      if (args[2].includes(".State.Running")) return { stdout: "true healthy" };
      assert.equal(
        args[2],
        "{{json .Mounts}} {{json .NetworkSettings.Networks}}",
      );
      return { stdout: "unchanged-mounts-and-networks" };
    },
  };
  await simulate(api, process);
  return { def, runtime, release, source, commands, writes, output, process };
}
test("future baseline example captures running runtime ID, retains installed release ID, writes root-only selectors without container operations", async () => {
  const f = await fixture();
  assert.equal(f.process.exitCode, 0);
  selectorSource(f.source, f.def);
  assert(f.source.includes(`CUSTOMER_IMAGE=${f.runtime}`));
  assert(f.source.includes(`CUSTOMER_RELEASE_IMAGE=${f.release}`));
  assert(
    f.writes.some(
      ([kind, path]) =>
        kind === "backup" &&
        path.startsWith(f.def.imagesFile + ".before-immutable."),
    ),
  );
  assert(
    f.writes.some(
      ([kind, path, mode]) =>
        kind === "chmod" && path === f.def.imagesFile && mode === 0o600,
    ),
  );
  assert(
    f.writes.some(
      ([kind, path]) => kind === "atomic" && path === f.def.imagesFile,
    ),
  );
  assert(!JSON.stringify(f.commands).includes("postgres"));
  assert(!f.output.join("").includes(f.runtime));
});
for (const fault of ["missing-release", "invalid-source"]) {
  test(`future baseline example fails before writes for ${fault} and suppresses protected output`, async () => {
    const f = await fixture(fault);
    assert.equal(f.process.exitCode, 1);
    assert.equal(f.writes.length, 0);
    assert.equal(f.output.length, 1);
    assert(f.output[0].startsWith("Customer baseline normalization failed;"));
  });
}
