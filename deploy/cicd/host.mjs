import { execFile } from "node:child_process";
import { promisify, isDeepStrictEqual } from "node:util";
import { readFile, rename, stat, lstat, open } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import {
  operation,
  execute,
  images,
  immutable,
  rollbackReference,
} from "./deployment.mjs";
import {
  configuration,
  composeArguments,
  selectorSource,
  composeTopology,
} from "./configuration.mjs";

const exec = promisify(execFile);
const CONFIG = "/etc/maqamstay-staging/cicd.json";
const API = "https://maqamstay-api.169-58-95-12.sslip.io";
let interrupted = false;
process.on("SIGTERM", () => {
  interrupted = true;
});
process.on("SIGINT", () => {
  interrupted = true;
});
process.on("SIGHUP", () => {
  interrupted = true;
});

// Never propagate stdout/stderr from commands: Docker/release errors can contain
// connection strings. Only the explicitly constructed evidence leaves this process.
async function run(bin, args, options = {}) {
  const { stdout } = await exec(bin, args, {
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      PATH: "/usr/sbin:/usr/bin:/sbin:/bin",
      HOME: "/root",
      ...options.env,
    },
    ...options,
  });
  return stdout.trim();
}
async function protectedPath(path, directory = false) {
  if (!isAbsolute(path)) throw new Error("Absolute path required");
  const info = await lstat(path);
  if (
    info.isSymbolicLink() ||
    info.uid !== 0 ||
    info.mode & 0o022 ||
    (directory ? !info.isDirectory() : !info.isFile())
  )
    throw new Error("Unsafe protected path");
  if (path !== "/") await protectedPath(dirname(path), true);
  return info;
}
async function privateEnv(path) {
  const info = await protectedPath(path);
  if (info.mode & 0o077 || info.nlink > 1)
    throw new Error("Environment must be root-only and unaliased");
}
export async function atomic(path, value) {
  const temp = `${path}.pending`;
  const file = await open(temp, "wx", 0o600);
  try {
    await file.writeFile(value);
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temp, path);
  if (process.platform !== "win32") {
    const directory = await open(dirname(path), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}
export async function selectors(path, updates) {
  const source = await readFile(path, "utf8");
  const lines = source.split("\n");
  for (const [key, value] of Object.entries(updates)) {
    if (
      !/^[A-Z_]+$/.test(key) ||
      !/^(?:ghcr\.io\/shhassan699-maker\/maqamstay-[a-z-]+@)?sha256:[a-f0-9]{64}$/.test(
        value,
      )
    )
      throw new Error("Invalid image selector");
    const matches = lines
      .map((line, i) =>
        new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line) ? i : -1,
      )
      .filter((i) => i >= 0);
    if (matches.length !== 1 || !lines[matches[0]].startsWith(`${key}=`))
      throw new Error("Missing or duplicate selector");
    lines[matches[0]] = `${key}=${value}`;
  }
  await atomic(path, lines.join("\n"));
}
async function probe(
  url,
  expected = 200,
  headers = {},
  validate,
  method = "GET",
) {
  try {
    const result = await run("/usr/bin/curl", [
      "--disable", // First option: ignore curlrc credentials/configuration.
      "--silent",
      "--request",
      method,
      "--show-error",
      "--max-time",
      "12",
      "--max-filesize",
      "2097152",
      "--proto",
      "=http,https",
      "--dump-header",
      "-",
      "--output",
      "-",
      ...Object.entries(headers).flatMap(([key, value]) => [
        "--header",
        `${key}: ${value}`,
      ]),
      url,
    ]);
    const sections = result.split(/\r?\n\r?\n/);
    const head = sections.shift();
    const status = Number(head.match(/^HTTP\/\S+ (\d+)/)?.[1]);
    return (
      status === expected &&
      (!validate || validate(head, sections.join("\n\n")))
    );
  } catch {
    return false;
  }
}
function location(head) {
  return head.match(/^location:\s*(.+)$/im)?.[1].trim();
}

// Internal readiness and public ingress policy are separate acceptance checks.
// ServiceGuard + integration tests require 401 without X-API-Key. The reviewed
// catalog ingress allows GET only: protected GET paths are 404, writes are 405.
// No application credential, cookie, request body or response body is exported.
export async function inventoryApiHealth(
  check = probe,
  health = {
    localApiOrigin: "http://127.0.0.1:4000",
    publicCatalogOrigin: API,
  },
) {
  const API = health.publicCatalogOrigin;
  const checks = [
    [health.localApiOrigin + "/health/live", 200, "GET"],
    [health.localApiOrigin + "/health/ready", 200, "GET"],
    [API + "/api/v1/public/hotels", 401, "GET"],
    ...[
      "/health/live",
      "/health/ready",
      "/docs",
      "/docs-json",
      "/api/v1/admin/hotels",
      "/api/v1/auth/me",
      "/api/v1/auth/login",
    ].map((path) => [API + path, 404, "GET"]),
    ...["POST", "PUT", "PATCH", "DELETE"].map((method) => [
      API + "/api/v1/public/hotels",
      405,
      method,
    ]),
  ];
  for (const [url, status, method] of checks) {
    if (!(await check(url, status, {}, (head) => !location(head), method)))
      return false;
  }
  return true;
}

const hostIO = {
  run,
  readFile,
  stat,
  lstat,
  protectedPath,
  privateEnv,
  selectors,
  atomic,
  probe,
};
export async function createHost(
  document,
  definition,
  input,
  mode,
  overrides = {},
) {
  const {
    run,
    readFile,
    stat,
    lstat,
    protectedPath,
    privateEnv,
    selectors,
    atomic,
    probe,
  } = { ...hostIO, ...overrides };
  const config = configuration(document);
  if (
    !["deploy", "validate"].includes(mode) ||
    definition.repository !== input.repository ||
    !isDeepStrictEqual(definition, config.deployments[input.app])
  )
    throw new Error("Cross-repository deployment rejected");
  const KEYS = definition.imageSelectors;
  const PUBLIC = definition.health.publicOrigin;
  const CRM = definition.health.crmOrigin;
  const ADMIN = definition.health.publicAdminOrigin;
  const MEDIA = definition.media?.hostPath;
  await privateEnv(definition.imagesFile);
  for (const path of definition.composeFiles) await protectedPath(path);
  for (const path of new Set(Object.values(definition.environmentFiles)))
    await privateEnv(path);
  await protectedPath(config.stateDirectory, true);
  await privateEnv(definition.lockFile);
  selectorSource(await readFile(definition.imagesFile, "utf8"), definition);
  const base = composeArguments(definition);
  const environment = {
    PATH: "/usr/sbin:/usr/bin:/sbin:/bin",
    HOME: "/root",
    ...definition.environmentFiles,
  };
  const compose = (...args) =>
    run("/usr/bin/docker", [...base, ...args], { env: environment });
  const runtime = (service) => {
    if (!definition.runtimeServices.includes(service))
      throw new Error("Cross-deployment service rejected");
  };
  const id = async (service) => {
    if (
      !definition.runtimeServices.includes(service) &&
      service !== definition.databaseService
    )
      throw new Error("Cross-deployment inspection rejected");
    const value = await compose("ps", "-q", service);
    if (!/^[a-f0-9]{12,64}$/.test(value))
      throw new Error("Exactly one existing container required");
    const project = await run("/usr/bin/docker", [
      "inspect",
      "--format",
      '{{index .Config.Labels "com.docker.compose.project"}}',
      value,
    ]);
    if (project !== definition.project)
      throw new Error("Wrong Compose project");
    const label = await run("/usr/bin/docker", [
      "inspect",
      "--format",
      '{{index .Config.Labels "com.docker.compose.service"}}',
      value,
    ]);
    if (label !== service) throw new Error("Wrong Compose service");
    return value;
  };
  let mediaIdentity;
  let databaseIdentity;
  let recovering = false;
  const checkInterrupt = () => {
    if (interrupted && !recovering) throw new Error("Interrupted");
  };
  const healthyContainer = async (service) => {
    const container = await id(service);
    const health = await run("/usr/bin/docker", [
      "inspect",
      "--format",
      "{{.State.Running}} {{if .State.Health}}{{.State.Health.Status}}{{end}}",
      container,
    ]);
    return health === "true healthy";
  };
  const database = async () => {
    const container = await id("postgres");
    const identity = await run("/usr/bin/docker", [
      "inspect",
      "--format",
      "{{json .Mounts}} {{json .NetworkSettings.Networks}}",
      container,
    ]);
    if (
      databaseIdentity &&
      (databaseIdentity.container !== container ||
        databaseIdentity.identity !== identity)
    )
      throw new Error("PostgreSQL storage/network identity changed");
    databaseIdentity ??= { container, identity };
    return healthyContainer("postgres");
  };
  const inventoryNetwork = async (service) => {
    const networks = JSON.parse(
      await run("/usr/bin/docker", [
        "inspect",
        "--format",
        "{{json .NetworkSettings.Networks}}",
        await id(service),
      ]),
    );
    if (
      !networks ||
      Object.keys(networks).length !== 1 ||
      !Object.hasOwn(networks, "maqamstay_inventory_app")
    )
      throw new Error("Inventory must remain on its own network");
  };
  const media = async () => {
    const info = await stat(MEDIA);
    if (!info.isDirectory() || `${info.dev}:${info.ino}` !== mediaIdentity)
      throw new Error("Media directory changed");
    const mounts = JSON.parse(
      await run("/usr/bin/docker", [
        "inspect",
        "--format",
        "{{json .Mounts}}",
        await id("inventory-api"),
      ]),
    );
    if (
      !mounts.some(
        (m) =>
          m.Type === "bind" &&
          m.Source === MEDIA &&
          m.Destination === definition.media.containerPath &&
          m.RW,
      )
    )
      throw new Error("Media bind missing");
    await inventoryNetwork("inventory-api");
    if (mode === "validate") return;
    await run("/usr/bin/docker", [
      "exec",
      await id("inventory-api"),
      "node",
      "-e",
      "const f=require('node:fs');f.accessSync('/data/media',f.constants.R_OK|f.constants.W_OK)",
    ]);
  };
  const safety = async () => {
    checkInterrupt();
    const root = await run("/usr/bin/docker", [
      "info",
      "--format",
      "{{.DockerRootDir}}",
    ]);
    const paths = [
      ...new Set([
        root,
        dirname(definition.imagesFile),
        config.stateDirectory,
        ...(MEDIA ? [MEDIA] : []),
      ]),
    ];
    for (const path of paths) {
      const output = await run("/usr/bin/df", ["-B1", "--output=avail", path]);
      const free = Number(output.split("\n").at(-1).trim());
      if (!Number.isSafeInteger(free) || free < 12 * 1024 ** 3)
        throw new Error("At least 12 GiB free disk required");
    }
    const ram = Number(
      (await readFile("/proc/meminfo", "utf8")).match(
        /^MemAvailable:\s+(\d+) kB/m,
      )?.[1],
    );
    if (
      !Number.isFinite(ram) ||
      ram < (config.minimumAvailableRamMiB ?? 512) * 1024
    )
      throw new Error("Insufficient available RAM");
  };
  const host = {
    now: () => new Date().toISOString(),
    safety,
    preflight: async (app) => {
      if (app !== input.app)
        throw new Error("Cross-deployment preflight rejected");
      await safety();
      await compose("config", "--quiet");
      // Capture only in memory; rendered env/configuration is NEVER printed.
      composeTopology(
        JSON.parse(await compose("config", "--format", "json")),
        definition,
      );
      if (mode !== "validate") await run("/usr/sbin/nginx", ["-t"]);
      if (app === "customer" && !(await database()))
        throw new Error("PostgreSQL not healthy");
      if (app === "inventory") {
        const info = await lstat(MEDIA);
        if (info.isSymbolicLink())
          throw new Error("Media path must be an existing directory");
        mediaIdentity = `${info.dev}:${info.ino}`;
        await media();
      }
    },
    previous: async (service) => {
      runtime(service);
      if (!(await healthyContainer(service)))
        throw new Error("Current service must be healthy");
      const container = await id(service);
      const imageId = await run("/usr/bin/docker", [
        "inspect",
        "--format",
        "{{.Image}}",
        container,
      ]);
      const digests = JSON.parse(
        await run("/usr/bin/docker", [
          "image",
          "inspect",
          "--format",
          "{{json .RepoDigests}}",
          imageId,
        ]),
      );
      const name =
        service === "customer"
          ? images.customer[0]
          : images.inventory[service === "inventory-api" ? 0 : 1];
      const digest = digests?.find((value) => immutable(value, name));
      // Existing locally built deployments can be recovered by their retained
      // immutable Docker image ID; no registry tag or VPS rebuild is necessary.
      const previous = digest || imageId;
      if (!rollbackReference(previous, name))
        throw new Error("No immutable rollback image");
      return previous;
    },
    journal: async (report) => {
      if (mode !== "deploy") throw new Error("Validation is read-only");
      const path = `${config.stateDirectory}/${input.app}-${input.commit}.json`;
      await atomic(path, JSON.stringify(report, null, 2) + "\n");
    },
    pull: async (reference) => {
      if (mode !== "deploy" || !input.references.includes(reference))
        throw new Error("Unapproved image mutation");
      checkInterrupt();
      await run("/usr/bin/docker", ["pull", reference]);
      const user = await run("/usr/bin/docker", [
        "image",
        "inspect",
        "--format",
        "{{.Config.User}}",
        reference,
      ]);
      const revision = await run("/usr/bin/docker", [
        "image",
        "inspect",
        "--format",
        '{{index .Config.Labels "org.opencontainers.image.revision"}}',
        reference,
      ]);
      if (user !== "node" || revision !== input.commit)
        throw new Error("Image identity differs from reviewed publication");
    },
    release: async (value) => {
      if (mode !== "deploy" || value !== input)
        throw new Error("Unapproved release mutation");
      checkInterrupt();
      if (value.app === "customer" && !(await database()))
        throw new Error("PostgreSQL lost health");
      // Override only this job's image. Other application's selectors remain intact.
      const jobName = `maqamstay-cicd-${value.app}-${value.commit}`;
      try {
        await run(
          "/usr/bin/docker",
          [
            ...base,
            "run",
            "--rm",
            "--name",
            jobName,
            "--no-deps",
            "--pull",
            "never",
            "-T",
            definition.release.service,
            ...definition.release.command,
          ],
          {
            env: {
              ...environment,
              [definition.release.imageSelector]:
                value.references[value.app === "customer" ? 1 : 0],
            },
            timeout: 300000,
          },
        );
      } finally {
        // A killed Docker client must not leave a mutation job running after the
        // shared lock is released. Only this named one-off is eligible for cleanup.
        const remaining = await run("/usr/bin/docker", [
          "ps",
          "-aq",
          "--filter",
          `name=^/${jobName}$`,
        ]);
        if (remaining) await run("/usr/bin/docker", ["rm", "-f", jobName]);
      }
    },
    select: async (selected, value) => {
      if (mode !== "deploy") throw new Error("Validation is read-only");
      for (const [service, reference] of Object.entries(selected)) {
        runtime(service);
        if (
          !rollbackReference(
            reference,
            images[input.app][definition.runtimeServices.indexOf(service)],
          )
        )
          throw new Error("Cross-deployment image rejected");
      }
      if (value && value !== input)
        throw new Error("Cross-deployment image selection rejected");
      // Rollback must proceed even after SIGTERM; future deployments still fail fast.
      recovering = !value;
      checkInterrupt();
      await selectors(definition.imagesFile, {
        ...Object.fromEntries(
          Object.entries(selected).map(([s, ref]) => [KEYS[s], ref]),
        ),
        ...(value?.app === "customer"
          ? { CUSTOMER_RELEASE_IMAGE: value.references[1] }
          : {}),
      });
    },
    recreate: async (service, rollback = false) => {
      if (mode !== "deploy") throw new Error("Validation is read-only");
      runtime(service);
      recovering = rollback;
      checkInterrupt();
      await compose(
        "up",
        "-d",
        "--no-deps",
        "--no-build",
        "--pull",
        "never",
        "--force-recreate",
        service,
      );
    },
    health: async (service, rollback = false) => {
      if (mode !== "deploy") throw new Error("Validation is read-only");
      runtime(service);
      recovering = rollback;
      const deadline = Date.now() + 90000;
      do {
        checkInterrupt();
        let ok = false;
        try {
          ok = await healthyContainer(service);
          if (input.app === "inventory") await inventoryNetwork(service);
          const expected = (await readFile(definition.imagesFile, "utf8"))
            .split("\n")
            .find((line) => line.startsWith(`${KEYS[service]}=`))
            ?.slice(KEYS[service].length + 1)
            .trim();
          const actual = await run("/usr/bin/docker", [
            "inspect",
            "--format",
            "{{.Image}}",
            await id(service),
          ]);
          const expectedId = await run("/usr/bin/docker", [
            "image",
            "inspect",
            "--format",
            "{{.Id}}",
            expected,
          ]);
          ok = ok && actual === expectedId;
          if (service === "customer") {
            ok =
              ok &&
              (await database()) &&
              (await probe(definition.health.localOrigin + "/", 200, {
                Host: new URL(PUBLIC).host,
              })) &&
              (await probe(PUBLIC + "/")) &&
              (await probe(CRM + "/admin/login")) &&
              (await probe(
                PUBLIC + "/admin",
                307,
                {},
                (head) => location(head) === CRM + "/admin",
              )) &&
              (await probe(
                PUBLIC + "/admin/login?ci=1",
                307,
                {},
                (head) => location(head) === CRM + "/admin/login?ci=1",
              )) &&
              (await probe(
                PUBLIC + "/api/admin",
                404,
                {},
                (head) => !location(head),
              )) &&
              (await probe(
                PUBLIC + "/api/admin/login",
                404,
                {},
                (head) => !location(head),
              )) &&
              (await probe(
                PUBLIC + "/api/admin/login",
                404,
                {},
                (head) => !location(head),
                "POST",
              )) &&
              (await probe(
                PUBLIC + "/hotels",
                200,
                {},
                (_head, body) =>
                  body.includes("catalog-city") &&
                  !body.includes(
                    "Hotel information is temporarily unavailable",
                  ),
              ));
          } else if (service === "inventory-api") {
            await media();
            ok = ok && (await inventoryApiHealth(probe, definition.health));
          } else {
            ok =
              ok &&
              (await probe(definition.health.localAdminOrigin + "/login")) &&
              (await probe(ADMIN + "/login"));
          }
        } catch {
          ok = false;
        }
        if (ok) return true;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } while (Date.now() < deadline);
      return false;
    },
  };
  host.currentHealth = async (service) => {
    runtime(service);
    if (input.app === "inventory") await inventoryNetwork(service);
    return healthyContainer(service);
  };
  return host;
}
async function main() {
  if (process.getuid?.() !== 0)
    throw new Error("Restricted root entry point required");
  operation(process.argv.slice(2));
  await privateEnv(CONFIG);
  const document = configuration(JSON.parse(await readFile(CONFIG, "utf8")));
  const report = await execute(document, process.argv.slice(2), createHost);
  process.stdout.write(JSON.stringify(report) + "\n");
  if (report.status !== "succeeded") process.exitCode = 1;
}
// This file is an executable entry point, not a module imported by tests.
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/host.mjs")) {
  main().catch(() => {
    process.stderr.write(
      "Host configuration or operation failed; review protected setup and deployment evidence.\n",
    );
    process.exitCode = 1;
  });
}
