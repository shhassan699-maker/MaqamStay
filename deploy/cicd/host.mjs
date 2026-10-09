import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rename, stat, lstat, open } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import {
  request,
  deploy,
  images,
  immutable,
  rollbackReference,
} from "./deployment.mjs";

const exec = promisify(execFile);
const CONFIG = "/etc/maqamstay-staging/cicd.json";
const KEYS = {
  customer: "CUSTOMER_IMAGE",
  "inventory-api": "INVENTORY_API_IMAGE",
  "inventory-admin": "INVENTORY_ADMIN_IMAGE",
};
const PUBLIC = "https://maqamstay-staging.169-58-95-12.sslip.io";
const CRM = "https://maqamstay-crm.169-58-95-12.sslip.io";
const ADMIN = "https://maqamstay-admin.169-58-95-12.sslip.io";
const API = "https://maqamstay-api.169-58-95-12.sslip.io";
const MEDIA = "/opt/maqamstay-staging/data/media";
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
  if (info.mode & 0o077) throw new Error("Environment must be root-only");
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

async function main() {
  if (process.getuid?.() !== 0 || process.argv.length !== 6)
    throw new Error("Restricted root entry point required");
  const input = request(process.argv.slice(2));
  await protectedPath(CONFIG);
  const config = JSON.parse(await readFile(CONFIG, "utf8"));
  if (
    config.minimumAvailableRamMiB !== undefined &&
    (!Number.isInteger(config.minimumAvailableRamMiB) ||
      config.minimumAvailableRamMiB < 512)
  )
    throw new Error("Invalid RAM safety threshold");
  if (
    !/^[a-z0-9][a-z0-9_-]+$/.test(config.project) ||
    !Array.isArray(config.composeFiles) ||
    config.composeFiles.length < 2
  )
    throw new Error("Invalid configuration");
  for (const path of [config.imagesFile, ...config.composeFiles])
    await protectedPath(path);
  await protectedPath(config.stateDirectory, true);
  const base = [
    "compose",
    "--project-name",
    config.project,
    "--env-file",
    config.imagesFile,
    ...config.composeFiles.flatMap((file) => ["-f", file]),
  ];
  const compose = (...args) => run("/usr/bin/docker", [...base, ...args]);
  const id = async (service) => {
    const value = await compose("ps", "-q", service);
    if (!/^[a-f0-9]{12,64}$/.test(value))
      throw new Error("Exactly one existing container required");
    const project = await run("/usr/bin/docker", [
      "inspect",
      "--format",
      '{{index .Config.Labels "com.docker.compose.project"}}',
      value,
    ]);
    if (project !== config.project) throw new Error("Wrong Compose project");
    return value;
  };
  let mediaIdentity;
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
          m.Destination === "/data/media" &&
          m.RW,
      )
    )
      throw new Error("Media bind missing");
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
        dirname(config.imagesFile),
        config.stateDirectory,
        MEDIA,
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
      await safety();
      await privateEnv("/etc/maqamstay-staging/customer.env");
      await privateEnv("/etc/maqamstay-staging/inventory.env");
      // Ensure selectors point to the existing files without printing Compose config.
      const source = await readFile(config.imagesFile, "utf8");
      for (const [key, path] of Object.entries({
        CUSTOMER_ENV_FILE: "/etc/maqamstay-staging/customer.env",
        INVENTORY_API_ENV_FILE: "/etc/maqamstay-staging/inventory.env",
      })) {
        if (
          source
            .split("\n")
            .filter((line) => line.trimEnd() === `${key}=${path}`).length !== 1
        )
          throw new Error("Unexpected runtime env selector");
      }
      for (const key of [
        "CUSTOMER_RELEASE_ENV_FILE",
        "INVENTORY_RELEASE_ENV_FILE",
        "POSTGRES_ENV_FILE",
      ]) {
        const values = source
          .split("\n")
          .filter((line) => line.startsWith(`${key}=`));
        if (values.length !== 1)
          throw new Error("Missing protected job env selector");
        await privateEnv(values[0].slice(key.length + 1).trim());
      }
      await compose("config", "--quiet");
      await run("/usr/sbin/nginx", ["-t"]);
      if (app === "customer" && !(await healthyContainer("postgres")))
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
      const path = `${config.stateDirectory}/${input.app}-${input.commit}.json`;
      await atomic(path, JSON.stringify(report, null, 2) + "\n");
    },
    pull: async (reference) => {
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
      checkInterrupt();
      if (value.app === "customer" && !(await healthyContainer("postgres")))
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
            ...(value.app === "customer"
              ? ["customer-release", "npm", "run", "db:migrate"]
              : [
                  "inventory-release",
                  "node",
                  "dist/apps/api/src/cli.js",
                  "indexes",
                ]),
          ],
          {
            env: {
              PATH: "/usr/sbin:/usr/bin:/sbin:/bin",
              HOME: "/root",
              [value.app === "customer"
                ? "CUSTOMER_RELEASE_IMAGE"
                : "INVENTORY_API_IMAGE"]:
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
      // Rollback must proceed even after SIGTERM; future deployments still fail fast.
      recovering = !value;
      checkInterrupt();
      await selectors(config.imagesFile, {
        ...Object.fromEntries(
          Object.entries(selected).map(([s, ref]) => [KEYS[s], ref]),
        ),
        ...(value?.app === "customer"
          ? { CUSTOMER_RELEASE_IMAGE: value.references[1] }
          : {}),
      });
    },
    recreate: async (service, rollback = false) => {
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
      recovering = rollback;
      const deadline = Date.now() + 90000;
      do {
        checkInterrupt();
        let ok = false;
        try {
          ok = await healthyContainer(service);
          const expected = (await readFile(config.imagesFile, "utf8"))
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
              (await probe("http://127.0.0.1:3000/", 200, {
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
            ok =
              ok &&
              (await probe("http://127.0.0.1:4000/health/live")) &&
              (await probe("http://127.0.0.1:4000/health/ready")) &&
              (await probe(API + "/health/live")) &&
              (await probe(API + "/health/ready"));
          } else {
            ok =
              ok &&
              (await probe("http://127.0.0.1:3100/login")) &&
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
  const report = await deploy(input, host);
  process.stdout.write(JSON.stringify(report) + "\n");
  if (report.status !== "succeeded") process.exitCode = 1;
}
// This file is an executable entry point, not a module imported by tests.
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/host.mjs")) {
  main().catch(() => {
    process.stderr.write(
      "Deployment preflight or evidence persistence failed; consult protected VPS journal.\n",
    );
    process.exitCode = 1;
  });
}
