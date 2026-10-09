import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  configuration,
  exampleConfiguration,
  selectDeployment,
  composeArguments,
  composeTopology,
  selectorSource,
} from "./configuration.mjs";
import { operation, execute, images, request } from "./deployment.mjs";
import { createHost, privateEnv } from "./host.mjs";
const sha = "a".repeat(40);
const digest = "sha256:" + "b".repeat(64);
const previous = "sha256:" + "c".repeat(64);
test("the shipped v2 config models two exact projects, ordered files, separate selectors, environment roles and a shared lock", () => {
  const doc = configuration(
    JSON.parse(readFileSync("deploy/cicd/cicd.example.json", "utf8")),
  );
  assert.deepEqual(doc, exampleConfiguration());
  const customer = selectDeployment(doc, "customer");
  const inventory = selectDeployment(doc, "inventory");
  assert.equal(customer.repository, "shhassan699-maker/MaqamStay");
  assert.equal(customer.project, "maqamstay-customer-staging");
  assert.deepEqual(customer.composeFiles, [
    "/opt/maqamstay-staging/customer/deploy/docker-compose.staging.yml",
    "/opt/maqamstay-staging/deployment/phase3b-customer.override.yml",
  ]);
  assert.equal(
    customer.imagesFile,
    "/opt/maqamstay-staging/deployment/customer-images.env",
  );
  assert.deepEqual(customer.runtimeServices, ["customer"]);
  assert.equal(customer.databaseService, "postgres");
  assert.equal(
    inventory.repository,
    "shhassan699-maker/MaqamStay-Inventory-Admin",
  );
  assert.equal(inventory.project, "maqamstay-staging");
  assert.deepEqual(inventory.composeFiles, [
    "/opt/maqamstay-staging/inventory/deploy/docker-compose.staging.yml",
  ]);
  assert.equal(
    inventory.imagesFile,
    "/opt/maqamstay-staging/deployment/inventory-images.env",
  );
  assert.deepEqual(inventory.runtimeServices, [
    "inventory-api",
    "inventory-admin",
  ]);
  assert.equal(inventory.databaseService, null);
  assert.equal(
    inventory.environmentFiles.INVENTORY_RELEASE_ENV_FILE,
    "/etc/maqamstay-staging/inventory.env",
  );
  assert.equal(customer.lockFile, inventory.lockFile);
  assert.deepEqual(customer.requiredProfiles, ["release"]);
  assert.deepEqual(inventory.requiredProfiles, ["release"]);
  assert.notEqual(customer.imagesFile, inventory.imagesFile);
});
const mutations = {
  "unknown top-level field": (d) => {
    d.project = "arbitrary";
  },
  "missing repository definition": (d) => {
    delete d.deployments.inventory;
  },
  "ambiguous repository mapping": (d) => {
    d.deployments.inventory.repository = d.deployments.customer.repository;
  },
  "unknown repository definition": (d) => {
    d.deployments.other = d.deployments.customer;
  },
  "relative Compose path": (d) => {
    d.deployments.customer.composeFiles[0] = "customer.yml";
  },
  "outside approved root": (d) => {
    d.deployments.inventory.imagesFile = "/tmp/images.env";
  },
  "unapproved project": (d) => {
    d.deployments.customer.project = "channel_frontend";
  },
  "wrong Compose ordering": (d) => {
    d.deployments.customer.composeFiles.reverse();
  },
  "missing Compose definition": (d) => {
    d.deployments.customer.composeFiles.pop();
  },
  "selector reuse": (d) => {
    d.deployments.inventory.imagesFile = d.deployments.customer.imagesFile;
  },
  "Customer includes Inventory": (d) => {
    d.deployments.customer.runtimeServices.push("inventory-api");
  },
  "Inventory includes PostgreSQL": (d) => {
    d.deployments.inventory.runtimeServices.push("postgres");
  },
  "Inventory includes Customer": (d) => {
    d.deployments.inventory.runtimeServices.push("customer");
  },
  "unknown service": (d) => {
    d.deployments.inventory.runtimeServices.push("other");
  },
  "secret field": (d) => {
    d.deployments.inventory.SESSION_SECRET =
      "synthetic-value-must-not-be-printed";
  },
  "secret in nested env config": (d) => {
    d.deployments.inventory.environmentFiles.MONGODB_URI = "synthetic-value";
  },
  "arbitrary release command": (d) => {
    d.deployments.customer.release.command = ["sh", "-c", "id"];
  },
  "arbitrary public probe": (d) => {
    d.deployments.inventory.health.publicCatalogOrigin =
      "https://other.example.test";
  },
  "different lock": (d) => {
    d.deployments.inventory.lockFile = "/tmp/lock";
  },
  "unsafe RAM threshold": (d) => {
    d.minimumAvailableRamMiB = 0;
  },
  "missing required profiles": (d) => {
    delete d.deployments.customer.requiredProfiles;
  },
  "empty required profiles": (d) => {
    d.deployments.inventory.requiredProfiles = [];
  },
  "unknown profile": (d) => {
    d.deployments.customer.requiredProfiles = ["other"];
  },
  "duplicate profiles": (d) => {
    d.deployments.inventory.requiredProfiles = ["release", "release"];
  },
  "profile type": (d) => {
    d.deployments.customer.requiredProfiles = "release";
  },
  "profile injection": (d) => {
    d.deployments.inventory.requiredProfiles = ["release; id"];
  },
  "unknown profile configuration field": (d) => {
    d.deployments.customer.profiles = ["release"];
  },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`strict v2 schema rejects ${name} before host creation`, async () => {
    const doc = exampleConfiguration();
    mutate(doc);
    let called = false;
    await assert.rejects(
      execute(doc, ["validate", "customer", sha], () => {
        called = true;
      }),
      /Invalid protected deployment configuration/,
    );
    assert.equal(called, false);
  });
}
test("operation protocol rejects unknown repos, services, projects, paths, digest injection and extra tokens", () => {
  for (const args of [
    ["validate", "unknown", sha],
    ["validate", "customer", "short"],
    ["validate", "customer", sha, "postgres"],
    ["validate", "customer", sha, "/tmp/x.yml"],
    ["validate", "customer", sha, "--profile", "release"],
    ["deploy", "inventory", sha, digest, digest, "--profile", "other"],
    ["validate", "customer; id", sha],
    ["validate", "inventory", sha + "; id"],
    ["deploy", "inventory", sha, digest, digest, "customer"],
    ["deploy", "customer", sha, "latest", digest],
    ["destroy", "customer", sha],
  ])
    assert.throws(() => operation(args));
  assert.throws(() => selectDeployment(exampleConfiguration(), "unknown"));
});
function fixture(app, faults = {}) {
  const doc = exampleConfiguration();
  const def = doc.deployments[app];
  const commands = [],
    paths = [],
    writes = [],
    probes = [];
  const selected = Object.fromEntries(
    Object.values(def.imageSelectors).map((key, i) => [
      key,
      `ghcr.io/shhassan699-maker/${images[app][i]}@${previous}`,
    ]),
  );
  const running = Object.fromEntries(
    def.runtimeServices.map((service) => [
      service,
      selected[def.imageSelectors[service]],
    ]),
  );
  const all = [
    ...def.runtimeServices,
    ...(def.databaseService ? [def.databaseService] : []),
  ];
  const ids = Object.fromEntries(
    all.map((service, i) => [service, String(i + 1).repeat(64)]),
  );
  const envFiles = [...new Set(Object.values(def.environmentFiles))];
  const rendered = {
    services: Object.fromEntries(
      [
        ...def.runtimeServices,
        def.release.service,
        ...(def.databaseService ? [def.databaseService] : []),
      ].map((s) => [
        s,
        {
          networks: { app: {} },
          env_file: [{ path: envFiles[0] }],
        },
      ]),
    ),
    networks: { app: { name: "maqamstay_inventory_app" } },
  };
  const io = {
    protectedPath: async (path) => {
      paths.push(path);
      if (path === faults.missing) throw Error("Missing protected path");
    },
    privateEnv: async (path) => {
      paths.push(path);
      if (path === faults.missing) throw Error("Invalid protected env");
      if (path === def.imagesFile && faults.selectorMode !== undefined)
        await privateEnv(
          path,
          permissionReader(path, { mode: faults.selectorMode }),
        );
    },
    readFile: async (path) => {
      paths.push(path);
      if (path === "/proc/meminfo") return "MemAvailable: 2097152 kB\n";
      assert.equal(path, def.imagesFile);
      return (
        Object.entries(selected)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n") + "\n"
      );
    },
    lstat: async (path) => {
      paths.push(path);
      return { dev: 1, ino: 1, isSymbolicLink: () => false };
    },
    stat: async (path) => {
      paths.push(path);
      return {
        dev: 1,
        ino: faults.mediaChanged ? 2 : 1,
        isDirectory: () => true,
      };
    },
    atomic: async (path) => {
      writes.push(["journal", path]);
    },
    selectors: async (path, updates) => {
      assert.equal(path, def.imagesFile);
      writes.push(["selectors", path, updates]);
      Object.assign(selected, updates);
    },
    probe: async (...args) => {
      probes.push(args);
      return true;
    },
    run: async (bin, args, options) => {
      commands.push([bin, args, options]);
      if (bin === "/usr/bin/df")
        return `Avail\n${faults.lowDisk ? 1024 : 30 * 1024 ** 3}`;
      if (bin === "/usr/sbin/nginx") return "";
      assert.equal(bin, "/usr/bin/docker");
      if (args[0] === "compose") {
        const base = composeArguments(def);
        assert.deepEqual(args.slice(0, base.length), base);
        for (const [key, path] of Object.entries(def.environmentFiles))
          assert.equal(options.env[key], path);
        let cmd = args.slice(base.length);
        const enabled = [];
        while (cmd[0] === "--profile") {
          enabled.push(cmd[1]);
          cmd = cmd.slice(2);
        }
        if (cmd[0] === "config") {
          const effective = structuredClone(rendered);
          if (!enabled.includes("release") || faults.missingRelease)
            delete effective.services[def.release.service];
          return cmd.includes("json") ? JSON.stringify(effective) : "";
        }
        if (cmd[0] === "ps") return ids[cmd.at(-1)];
        if (cmd[0] === "up") {
          assert.deepEqual(enabled, []); // No profile on any runtime recreation.
          const s = cmd.at(-1);
          assert(def.runtimeServices.includes(s));
          running[s] = selected[def.imageSelectors[s]];
          return "";
        }
        if (cmd[0] === "run") {
          assert.deepEqual(enabled, ["release"]);
          assert(cmd.includes(def.release.service));
          assert(cmd.includes("--no-deps"));
          assert.equal(
            options.env[def.release.imageSelector],
            request([app, sha, digest, digest]).references[
              app === "customer" ? 1 : 0
            ],
          );
          return "";
        }
      }
      if (args[0] === "info") return "/var/lib/docker";
      if (args[0] === "pull" || args[0] === "exec") return "";
      if (args[0] === "ps") return "";
      if (args[0] === "inspect") {
        const format = args[2],
          service = all.find((s) => ids[s] === args.at(-1));
        assert(service);
        if (format.includes("compose.project")) return def.project;
        if (format.includes("compose.service")) return service;
        if (format.includes(".State.Running"))
          return faults.unhealthy === service
            ? "true unhealthy"
            : "true healthy";
        if (format === "{{.Image}}") return running[service].split("@")[1];
        if (format.includes("Mounts") && format.includes("Networks"))
          return "stable-postgres-volume-and-network";
        if (format.includes("Networks"))
          return JSON.stringify({
            [faults.networkLeak
              ? "maqamstay_customer_db"
              : "maqamstay_inventory_app"]: {},
          });
        if (format.includes("Mounts"))
          return JSON.stringify([
            {
              Type: "bind",
              Source: def.media.hostPath,
              Destination: "/data/media",
              RW: true,
            },
          ]);
      }
      if (args[0] === "image") {
        const format = args[3];
        if (format.includes("RepoDigests"))
          return JSON.stringify(
            images[app].map(
              (name) => `ghcr.io/shhassan699-maker/${name}@${previous}`,
            ),
          );
        if (format.includes(".Config.User")) return "node";
        if (format.includes("revision")) return sha;
        if (format.includes(".Id")) return args.at(-1).split("@").at(-1);
      }
      throw Error("Unrecognized simulator operation");
    },
  };
  return {
    doc,
    def,
    commands,
    paths,
    writes,
    probes,
    rendered,
    factory: (document, definition, input, mode) =>
      createHost(document, definition, input, mode, io),
  };
}
for (const app of ["customer", "inventory"]) {
  test(`${app}: profiled release is visible in quiet and JSON topology validation`, async () => {
    const f = fixture(app);
    // The simulator omits release services unless the actual host asks for the profile.
    const report = await execute(f.doc, ["validate", app, sha], f.factory);
    assert.equal(report.status, "succeeded");
    const renders = f.commands.filter(
      ([, args]) => args[0] === "compose" && args.includes("config"),
    );
    assert.equal(renders.length, 2);
    for (const [, args] of renders) {
      assert.deepEqual(
        args.slice(0, composeArguments(f.def, true).length),
        composeArguments(f.def, true),
      );
      assert.equal(args[args.indexOf("--profile") + 1], "release");
    }
    assert.equal(f.writes.length, 0);
  });
  test(`${app}: missing release fails despite enabled profile, without mutation`, async () => {
    const f = fixture(app, { missingRelease: true });
    assert.equal(
      (await execute(f.doc, ["validate", app, sha], f.factory)).status,
      "failed",
    );
    assert.equal(f.writes.length, 0);
    assert(
      !f.commands.some(
        ([, args]) =>
          args.includes("run") || args.includes("up") || args.includes("pull"),
      ),
    );
  });
  test(`${app}: insecure selector permissions fail before any Docker operation`, async () => {
    const f = fixture(app, { selectorMode: 0o644 });
    await assert.rejects(execute(f.doc, ["validate", app, sha], f.factory));
    assert.equal(f.commands.length, 0);
    assert.equal(f.writes.length, 0);
  });
  test(`${app}: validation uses actual host adapter, correct Compose routing and zero mutating operations`, async () => {
    const f = fixture(app);
    const report = await execute(f.doc, ["validate", app, sha], f.factory);
    assert.equal(report.status, "succeeded");
    assert.equal(report.mutated, false);
    assert.equal(f.writes.length, 0);
    assert.equal(f.probes.length, 0); // No HTTP requests/rate-limit/database writes.
    for (const [bin, args] of f.commands) {
      assert.notEqual(bin, "/usr/sbin/nginx");
      assert(
        !args.some((a) =>
          ["pull", "run", "up", "rm", "exec", "prune"].includes(a),
        ),
      );
    }
    const other =
      f.doc.deployments[app === "customer" ? "inventory" : "customer"];
    assert(!f.paths.includes(other.imagesFile));
    assert(!f.paths.includes(Object.values(other.environmentFiles)[0]));
    if (app === "inventory")
      assert(!JSON.stringify(f.commands).includes("postgres"));
  });
  test(`${app}: deploy/release/recreation use only its selectors and runtime services`, async () => {
    const f = fixture(app);
    const report = await execute(
      f.doc,
      ["deploy", app, sha, digest, digest],
      f.factory,
    );
    assert.equal(report.status, "succeeded");
    const ups = f.commands.filter(
      ([, args]) => args[0] === "compose" && args.includes("up"),
    );
    assert.deepEqual(
      ups.map(([, args]) => args.at(-1)),
      f.def.runtimeServices,
    );
    for (const [, args] of ups)
      assert(
        args.includes("--no-deps") &&
          args.includes("--no-build") &&
          !args.includes("--profile"),
      );
    assert(!ups.some(([, args]) => args.at(-1) === f.def.release.service));
    for (const [kind, path] of f.writes)
      if (kind === "selectors") assert.equal(path, f.def.imagesFile);
    if (app === "inventory")
      assert(!JSON.stringify(f.commands).includes("postgres"));
    else assert(!ups.some(([, args]) => args.includes("postgres")));
  });
  test(`${app}: missing Compose file and low disk fail validation without mutations`, async () => {
    const f = fixture(app, { lowDisk: true });
    assert.equal(
      (await execute(f.doc, ["validate", app, sha], f.factory)).status,
      "failed",
    );
    assert.equal(f.writes.length, 0);
    const missing = fixture(app, { missing: f.def.composeFiles[0] });
    await assert.rejects(
      execute(missing.doc, ["validate", app, sha], missing.factory),
    );
    assert.equal(missing.commands.length, 0);
  });
  test(`${app}: host guards reject other application's service/image methods`, async () => {
    const f = fixture(app);
    const input = request([app, sha, digest, digest]);
    const host = await f.factory(f.doc, f.def, input, "deploy");
    const other = app === "customer" ? "inventory-api" : "postgres";
    await assert.rejects(host.recreate(other));
    await assert.rejects(host.previous(other));
    await assert.rejects(host.select({ [other]: previous }));
    await assert.rejects(
      f.factory(
        f.doc,
        f.doc.deployments[app === "customer" ? "inventory" : "customer"],
        input,
        "deploy",
      ),
    );
    assert.equal(f.writes.length, 0);
    assert.equal(f.commands.length, 0);
  });
  test(`${app}: validation adapter cannot execute mutation methods even if called directly`, async () => {
    const f = fixture(app);
    const host = await f.factory(
      f.doc,
      f.def,
      operation(["validate", app, sha]).input,
      "validate",
    );
    await assert.rejects(host.pull("ignored"));
    await assert.rejects(host.release({}));
    await assert.rejects(host.recreate(f.def.runtimeServices[0]));
    await assert.rejects(host.select({}));
    await assert.rejects(host.journal({}));
    assert.equal(f.writes.length, 0);
    assert.equal(f.commands.length, 0);
  });
}
test("Inventory validation rejects leaked Customer networks; schemas reject mixed effective Compose/selector files", async () => {
  const f = fixture("inventory", { networkLeak: true });
  assert.equal(
    (await execute(f.doc, ["validate", "inventory", sha], f.factory)).status,
    "failed",
  );
  const other = fixture("inventory");
  other.rendered.services.postgres = {};
  assert.throws(() => composeTopology(other.rendered, other.def));
  assert.throws(() =>
    selectorSource(`CUSTOMER_IMAGE=sha256:${"b".repeat(64)}\n`, other.def),
  );
});

function permissionReader(file, changes = {}, parentChanges = {}) {
  return async (path) => ({
    uid: 0,
    gid: 0,
    nlink: 1,
    mode: path === file ? 0o600 : 0o755,
    isSymbolicLink: () => false,
    isFile: () => path === file,
    isDirectory: () => path !== file,
    ...(path === file ? changes : parentChanges),
  });
}
test("private selectors retain root-only, regular, unaliased permission requirements", async () => {
  const path = "/opt/maqamstay-staging/deployment/customer-images.env";
  for (const mode of [0o600, 0o400])
    await privateEnv(path, permissionReader(path, { mode }));
  for (const changes of [
    { mode: 0o644 },
    { mode: 0o640 },
    { mode: 0o660 },
    { mode: 0o606 },
    { uid: 1000 },
    { nlink: 2 },
    { isSymbolicLink: () => true },
    { isFile: () => false },
  ])
    await assert.rejects(privateEnv(path, permissionReader(path, changes)));
});
test("private selectors reject non-root, symlink and writable ancestor directories", async () => {
  const path = "/opt/maqamstay-staging/deployment/customer-images.env";
  for (const parentChanges of [
    { mode: 0o775 },
    { mode: 0o777 },
    { uid: 1000 },
    { isSymbolicLink: () => true },
  ])
    await assert.rejects(
      privateEnv(path, permissionReader(path, {}, parentChanges)),
    );
});
for (const app of ["customer", "inventory"]) {
  const def = exampleConfiguration().deployments[app];
  const source = (reference) =>
    Object.values(def.imageSelectors)
      .map((key, i) => `${key}=${reference(images[app][i])}`)
      .join("\n");
  test(`${app}: selector parser accepts full local image IDs and matching GHCR manifest digests`, () => {
    assert.doesNotThrow(() =>
      selectorSource(
        source(() => digest),
        def,
      ),
    );
    assert.doesNotThrow(() =>
      selectorSource(
        source((name) => `ghcr.io/shhassan699-maker/${name}@${digest}`),
        def,
      ),
    );
  });
  test(`${app}: mutable tags, full commit tags and wrong image digests remain rejected`, () => {
    for (const reference of [
      () => "local/customer:staging",
      (name) => `ghcr.io/shhassan699-maker/${name}:latest`,
      (name) => `ghcr.io/shhassan699-maker/${name}:${sha}`,
      () => `ghcr.io/other/image@${digest}`,
      () => "sha256:short",
      () => digest.toUpperCase(),
    ])
      assert.throws(() => selectorSource(source(reference), def));
  });
}
for (const [app, failed] of [
  ["customer", "customer"],
  ["inventory", "inventory-api"],
  ["inventory", "inventory-admin"],
]) {
  test(`${app}: routed rollback restores only ${failed} in its own project/selector file`, async () => {
    const f = fixture(app);
    const factory = async (...args) => {
      const host = await f.factory(...args);
      const health = host.health;
      host.health = (service, rollback) =>
        rollback ? health(service, true) : Promise.resolve(service !== failed);
      return host;
    };
    const report = await execute(
      f.doc,
      ["deploy", app, sha, digest, digest],
      factory,
    );
    assert.equal(report.status, "failed");
    assert.deepEqual(Object.keys(report.rollback), [failed]);
    assert.equal(report.rollback[failed].healthy, true);
    const ups = f.commands.filter(
      ([, args]) => args[0] === "compose" && args.includes("up"),
    );
    assert.equal(ups.at(-1)[1].at(-1), failed);
    assert(!ups.some(([, args]) => args.at(-1) === "postgres"));
    if (app === "inventory")
      assert(!JSON.stringify(f.commands).includes("postgres"));
    for (const [kind, path] of f.writes)
      if (kind === "selectors") assert.equal(path, f.def.imagesFile);
  });
}
test("forced dispatcher admits only exact deploy/validate protocol and forwards no arbitrary arguments", () => {
  const dir = mkdtempSync(join(tmpdir(), "maqamstay-dispatch-"));
  const bash = process.env.CI_TEST_BASH || "bash";
  const bashPath = (p) =>
    p
      .replaceAll("\\", "/")
      .replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
  try {
    const script = join(dir, "dispatch.sh");
    const source = readFileSync(resolve("deploy/cicd/ssh-dispatch.sh"), "utf8");
    // Substitute ONLY the sudo executable with a shell built-in stub. The
    // installed script stays unchanged; no sudo, SSH or host command is run.
    writeFileSync(script, source.replaceAll("/usr/bin/sudo", "printf '%s\\n'"));
    for (const command of [
      `validate customer ${sha}`,
      `validate inventory ${sha}`,
      `deploy customer ${sha} ${digest} ${digest}`,
    ]) {
      const result = spawnSync(bash, [bashPath(script)], {
        encoding: "utf8",
        env: { ...process.env, SSH_ORIGINAL_COMMAND: command },
      });
      assert.equal(result.status, 0, result.stderr);
      assert(result.stdout.includes(command.split(" ").slice(0, 2).join("\n")));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
