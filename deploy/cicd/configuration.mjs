import { isDeepStrictEqual } from "node:util";

export const repositories = {
  customer: "shhassan699-maker/MaqamStay",
  inventory: "shhassan699-maker/MaqamStay-Inventory-Admin",
};
const root = "/opt/maqamstay-staging";
const protectedRoot = "/etc/maqamstay-staging";
export const lockFile = "/var/lib/maqamstay-cicd/deploy.lock";
const definitions = {
  customer: {
    repository: repositories.customer,
    project: "maqamstay-customer-staging",
    composeFiles: [
      `${root}/customer/deploy/docker-compose.staging.yml`,
      `${root}/deployment/phase3b-customer.override.yml`,
    ],
    imagesFile: `${root}/deployment/customer-images.env`,
    runtimeServices: ["customer"],
    imageSelectors: {
      customer: "CUSTOMER_IMAGE",
      "customer-release": "CUSTOMER_RELEASE_IMAGE",
    },
    environmentFiles: {
      CUSTOMER_ENV_FILE: `${protectedRoot}/customer.env`,
      CUSTOMER_RELEASE_ENV_FILE: `${protectedRoot}/customer-release.env`,
      POSTGRES_ENV_FILE: `${protectedRoot}/postgres.env`,
    },
    lockFile,
    databaseService: "postgres",
    release: {
      service: "customer-release",
      imageSelector: "CUSTOMER_RELEASE_IMAGE",
      command: ["npm", "run", "db:migrate"],
    },
    health: {
      profile: "customer-crm-v1",
      localOrigin: "http://127.0.0.1:3000",
      publicOrigin: "https://maqamstay-staging.169-58-95-12.sslip.io",
      crmOrigin: "https://maqamstay-crm.169-58-95-12.sslip.io",
    },
    media: null,
  },
  inventory: {
    repository: repositories.inventory,
    project: "maqamstay-staging",
    composeFiles: [`${root}/inventory/deploy/docker-compose.staging.yml`],
    imagesFile: `${root}/deployment/inventory-images.env`,
    runtimeServices: ["inventory-api", "inventory-admin"],
    imageSelectors: {
      "inventory-api": "INVENTORY_API_IMAGE",
      "inventory-admin": "INVENTORY_ADMIN_IMAGE",
    },
    environmentFiles: {
      INVENTORY_API_ENV_FILE: `${protectedRoot}/inventory.env`,
      INVENTORY_RELEASE_ENV_FILE: `${protectedRoot}/inventory.env`,
    },
    lockFile,
    databaseService: null,
    release: {
      service: "inventory-release",
      imageSelector: "INVENTORY_API_IMAGE",
      command: ["node", "dist/apps/api/src/cli.js", "indexes"],
    },
    health: {
      profile: "inventory-catalog-v1",
      localApiOrigin: "http://127.0.0.1:4000",
      localAdminOrigin: "http://127.0.0.1:3100",
      publicAdminOrigin: "https://maqamstay-admin.169-58-95-12.sslip.io",
      publicCatalogOrigin: "https://maqamstay-api.169-58-95-12.sslip.io",
    },
    media: { hostPath: `${root}/data/media`, containerPath: "/data/media" },
  },
};
export function exampleConfiguration() {
  return structuredClone({
    version: 2,
    stateDirectory: "/var/lib/maqamstay-cicd",
    minimumAvailableRamMiB: 512,
    deployments: definitions,
  });
}
function keys(value, expected) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), expected.toSorted())
  );
}
export function configuration(value) {
  // Exact reviewed topology is an allowlist, not arbitrary root command input.
  // Deep equality enforces nested field/type/path/service/origin/command schema
  // and rejects secret fields without ever including their values in an error.
  if (
    !keys(value, [
      "version",
      "stateDirectory",
      "minimumAvailableRamMiB",
      "deployments",
    ]) ||
    value.version !== 2 ||
    value.stateDirectory !== "/var/lib/maqamstay-cicd" ||
    !Number.isInteger(value.minimumAvailableRamMiB) ||
    value.minimumAvailableRamMiB < 512 ||
    value.minimumAvailableRamMiB > 65536 ||
    !keys(value.deployments, ["customer", "inventory"]) ||
    !Object.entries(definitions).every(([app, definition]) =>
      isDeepStrictEqual(value.deployments[app], definition),
    )
  )
    throw new Error("Invalid protected deployment configuration");
  return structuredClone(value);
}
export function selectDeployment(document, app) {
  if (!Object.hasOwn(repositories, app))
    throw new Error("Unknown deployment repository");
  return configuration(document).deployments[app];
}
export function composeArguments(definition) {
  if (!Object.values(definitions).some((d) => isDeepStrictEqual(d, definition)))
    throw new Error("Unapproved deployment definition");
  return [
    "compose",
    "--project-name",
    definition.project,
    "--env-file",
    definition.imagesFile,
    ...definition.composeFiles.flatMap((file) => ["-f", file]),
  ];
}
export function selectorSource(source, definition) {
  composeArguments(definition);
  const imageNames = {
    CUSTOMER_IMAGE: "maqamstay-customer",
    CUSTOMER_RELEASE_IMAGE: "maqamstay-customer-release",
    INVENTORY_API_IMAGE: "maqamstay-inventory-api",
    INVENTORY_ADMIN_IMAGE: "maqamstay-inventory-admin",
  };
  const ownImages = Object.values(definition.imageSelectors);
  const seen = new Set();
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^([A-Z_]+)=(\S+)$/);
    if (!match || seen.has(match[1]))
      throw new Error("Invalid protected image selectors");
    const [, key, value] = match;
    seen.add(key);
    if (ownImages.includes(key)) {
      const digest = `ghcr.io/shhassan699-maker/${imageNames[key]}@sha256:`;
      if (
        !/^sha256:[a-f0-9]{64}$/.test(value) &&
        !(
          value.startsWith(digest) &&
          /^[a-f0-9]{64}$/.test(value.slice(digest.length))
        )
      )
        throw new Error("Invalid protected image selectors");
    } else if (definition.environmentFiles[key] !== value) {
      throw new Error("Invalid protected image selectors");
    }
  }
  if (!ownImages.every((key) => seen.has(key)))
    throw new Error("Missing protected image selectors");
}
export function composeTopology(value, definition) {
  composeArguments(definition);
  const allowed = [
    ...definition.runtimeServices,
    definition.release.service,
    ...(definition.databaseService ? [definition.databaseService] : []),
  ];
  if (!value || !keys(value.services, allowed))
    throw new Error("Unexpected Compose service topology");
  if (definition.repository === repositories.inventory) {
    for (const service of Object.values(value.services)) {
      const networks = Object.keys(service.networks ?? {});
      if (
        networks.length !== 1 ||
        networks.some(
          (key) => value.networks?.[key]?.name !== "maqamstay_inventory_app",
        )
      )
        throw new Error("Unexpected Inventory network topology");
    }
  }
  // Rendered env values never leave memory. Root configuration cannot point
  // a release/runtime service at the other application's database environment.
  const files = new Set(Object.values(definition.environmentFiles));
  for (const service of Object.values(value.services)) {
    for (const env of service.env_file ?? []) {
      if (!files.has(typeof env === "string" ? env : env.path))
        throw new Error("Unexpected Compose environment source");
    }
  }
}
