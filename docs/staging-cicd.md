# Staging CI/CD implementation

Prepared in repositories only. No VPS connection, GHCR publication, deployment, key generation, staging branch creation or remote configuration was performed. This document supersedes the manual-publication/future-deployment sections of `staging-images.md` for routine code delivery. Initial infrastructure and secret provisioning remain operator work.

## Delivery contract

Both repositories have `.github/workflows/ci.yml` and `.github/workflows/publish-images.yml`. CI runs on `staging` pushes, all pull requests and reusable workflow calls. The publication/deployment pipeline runs **only on a push to `staging`**. It calls CI at the same commit, then publishes both application images, then deploys their digests. A failed CI or publication prevents deployment. The standalone CI push run also supplies a simple required branch check; the pipeline's reusable run is the deployment gate. No `workflow_dispatch`, `pull_request_target`, feature/main publication or PR deployment exists.

Protect `staging` against force pushes and require PR review and the CI `verify` check. Restrict changes to workflows, Dockerfiles, deployment scripts and database migrations with repository review rules. Merge/create `staging` through the owner's normal review process only after the setup guide is complete; its first push will start this pipeline. No path filters skip CI.

Before opening SSH, the deploy job reads the repository's current `staging` HEAD through the read-only GitHub API and refuses superseded source commits. A new push during a deployment queues the subsequent pipeline; running deployments are not canceled.

| Repository | CI gates                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Images                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Customer   | Clean `npm ci`; formatting; lint; strict `typecheck`; all Vitest tests; production build; Customer/CRM production HTTP fixtures; bundle/secret scans; image/repository regressions; CI/CD and shell/registry failure tests; actionlint; shellcheck; both isolated Docker image builds and runtime checks; `npm audit --omit=dev`                                                                                                                         | `ghcr.io/shhassan699-maker/maqamstay-customer`, `ghcr.io/shhassan699-maker/maqamstay-customer-release`     |
| Inventory  | Clean `npm ci` in Inventory and approved Customer fixture checkout; formatting; lint; strict API/test/Admin TypeScript; unit/integration/security tests including `tests/staging-storage.test.ts`; API/Admin and Customer builds; Chromium browser tests; both bundle scans; image/repository regressions; CI/CD and shell/registry failure tests; actionlint; shellcheck; isolated Admin/API Docker image builds/runtime checks; `npm audit --omit=dev` | `ghcr.io/shhassan699-maker/maqamstay-inventory-api`, `ghcr.io/shhassan699-maker/maqamstay-inventory-admin` |

The Customer tests retain public `/admin` redirects, public `/api/admin` denial, CRM host boundaries, Origin/CSRF guards, cookie attributes and catalog integration. Inventory's Customer browser fixture is pinned to approved commit `efd093b67050821580178a1504a71223a7f5d0b0`. That checkout must be readable by Actions (currently using the same public-repository mechanism as the existing CI). A private Customer repository requires a separately reviewed source-access solution before enabling this job; no application secret is a substitute.

Production audits have no severity exemption: **any production vulnerability fails CI**. Existing development-only advisory findings remain outside the production gate. No database mutation against a VPS/Atlas runs in CI. Test suites use synthetic credentials and disposable databases/storage.

All four images use full 40-character commit tags, `linux/amd64`, OCI revision labels, SBOM and provenance. Publication reuses existing SHA tags on workflow reruns; it fails closed on registry authorization/transport errors. CI is the only intended package writer. Do not manually overwrite/delete SHA tags. Deployment uses `@sha256:<64 hex>` references and rejects mutable tags, shortened SHAs and unapproved image namespaces. Confirm the VPS is x86-64 before adoption; adjust both build and verification architecture in a reviewed change if it is not.

Pulled images must retain `USER node` and an OCI revision matching the requested source commit. Post-recreation health also compares the running container's image ID to the image resolved by the selected immutable reference. Public build-variable changes require a new reviewed commit; an existing SHA tag is reused rather than rebuilt with different values.

Only publication has `contents: read` and `packages: write`, using `GITHUB_TOKEN`. CI and SSH deployment have only `contents: read`. Actions remain pinned to the existing immutable commit SHAs. No application or SSH secret enters a build. Customer's repository variable `STAGING_PUBLIC_WHATSAPP_NUMBER` is the approved **public** support number; its build origin is the public sslip HTTPS origin. Do not use a fabricated support number for published images. Admin's build argument is `http://inventory-api:4000`.

## Host contract and service protection

The root-owned code under `/usr/local/lib/maqamstay-cicd` is installed once by an operator from reviewed repository source. The SSH account cannot upload/replace it or edit Compose, runtime files or state. Routine workflows send only `deploy <customer|inventory> <full-sha> <digest-1> <digest-2>` through a forced SSH command. Repository changes to the host deployment engine or Compose require a separately reviewed operator installation; the pipeline never replaces those privileged files automatically.

`entry.sh` acquires `/var/lib/maqamstay-cicd/deploy.lock` in a root-only directory, shared by Customer and Inventory, before invoking `host.mjs`. GitHub concurrency serializes each repository with `cancel-in-progress: false`; GitHub concurrency is scoped to a repository, so the VPS lock supplies cross-repository exclusion. Lock wait is 10 minutes; host execution has a 30-minute ceiling and a final 10-minute termination grace for cleanup/rollback. The GitHub deployment job has a 60-minute budget, leaving time for lock wait, bounded execution/recovery and evidence upload. Host jobs and probes have individual timeouts. SIGTERM, SIGINT and SIGHUP request recovery at operation boundaries. A lock timeout fails the workflow; it does not bypass the lock. Manual mutation of this staging Compose project must use the same lock.

The root-owned, mode `0600` `/etc/maqamstay-staging/cicd.json` uses strict **version 2** with `deployments.customer` and `deployments.inventory`. This represents two independent Compose projects, not one combined stack. The SSH tokens `customer` and `inventory` map respectively to `shhassan699-maker/MaqamStay` and `shhassan699-maker/MaqamStay-Inventory-Admin`. Exactly one definition is selected before any host operation. Missing/ambiguous/unknown definitions, extra fields (including secrets), unapproved projects/paths/services/commands/origins, cross-routing and selector reuse are rejected. Paths, services and projects cannot be supplied over SSH. All config/Compose/env/selector paths and ancestors must be root-owned, non-symlink and not group/world-writable; config/env/selector/lock files are root-only and unaliased. RAM may be configured from 512 through 65536 MiB; other topology fields require a reviewed engine/schema change.

| Deployment | Compose project              | Ordered Compose files                                                                                                                       | Selector file                                            | Runtime services                   |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| Customer   | `maqamstay-customer-staging` | `/opt/maqamstay-staging/customer/deploy/docker-compose.staging.yml`, then `/opt/maqamstay-staging/deployment/phase3b-customer.override.yml` | `/opt/maqamstay-staging/deployment/customer-images.env`  | `customer`                         |
| Inventory  | `maqamstay-staging`          | `/opt/maqamstay-staging/inventory/deploy/docker-compose.staging.yml` only                                                                   | `/opt/maqamstay-staging/deployment/inventory-images.env` | `inventory-api`, `inventory-admin` |

Customer uses only `/etc/maqamstay-staging/customer.env`, `customer-release.env` and `postgres.env`; Inventory uses only `/etc/maqamstay-staging/inventory.env`, including its additive index job. The selected definition supplies these environment **paths** to Compose; no secret values are in JSON or SSH requests. Customer checks PostgreSQL before migration and preserves its container/mount/network identity through acceptance and rollback. Inventory performs no PostgreSQL inspection or operation, and both its effective Compose topology and container networks must remain on `maqamstay_inventory_app`. Effective Compose JSON is validated only in memory and never printed.

Both definitions use the same existing `/var/lib/maqamstay-cicd/deploy.lock`. Entry opens it read-only, acquires an exclusive lock, and closes FD 9 for descendants while the parent retains the lock. Neither validation nor deployment creates/replaces that lock file. Shared engine/config/test copies under `deploy/cicd` must be byte-for-byte identical in both repositories; drift requires review before any installation.

Preflight validates Compose quietly, runs `nginx -t`, checks current application health and immutable rollback references (GHCR digest or retained local Docker image ID), checks disk on Docker/selected-coordinator/journal filesystems and Inventory media only, and requires at least **12 GiB free** on each. RAM defaults to at least **512 MiB available**, configurable upward. Disk/RAM are checked again after pulls. Low resources abort without application recreation. There are no VPS builds or prune commands.

Every recreation uses `up -d --no-deps --no-build --pull never --force-recreate <one explicit service>`. The customer service list is only `customer`; Inventory's list is only `inventory-api`, `inventory-admin`. Existing PostgreSQL, volumes and unrelated applications cannot enter these recreation commands. No `down`, volume deletion, database reset/downgrade, profile backfill, seed or admin bootstrap exists in the routine path. `channel_frontend`, `channel_backend`, `skin_analysis_backend`, `skin_analysis_mongodb`, `skin_analysis_llama_cpp` and Quake Guard are outside the project/service contract. No routine Nginx write/reload occurs.

The two selector files are separate. Each may contain only its own image keys and matching optional env-path selectors. Current images must use reviewed GHCR digests or retained Docker image IDs; validation does not convert them. Customer atomically updates `CUSTOMER_IMAGE` and `CUSTOMER_RELEASE_IMAGE`; Inventory updates `INVENTORY_API_IMAGE`/`INVENTORY_ADMIN_IMAGE`. Unchanged lines are preserved byte-for-byte, and the other selector file is never opened or edited. Runtime files are never written. Customer Compose now obtains `INVENTORY_API_URL` from the protected runtime file rather than overriding it with an old hostname. The operator must retain the existing approved catalog URL when installing the reviewed Compose source.

## Release jobs, health and rollback

Customer requires healthy existing PostgreSQL. It pulls runtime/release digests, records the running Customer's previous immutable image reference, then executes `customer-release npm run db:migrate` with the new release image and `--no-deps`. Separate VPS-only migration credentials are recommended; `CUSTOMER_RELEASE_ENV_FILE` is fixed to `/etc/maqamstay-staging/customer-release.env`. No admin creation runs. Migration failure prevents recreation and requires manual database review.

Customer health requires Docker health, loopback `http://127.0.0.1:3000/` with the correct public Host, public HTTPS home, CRM `/admin/login`, public `/admin` and `/admin/login?ci=1` exact CRM redirects, public `/api/admin` and `/api/admin/login` 404 without Location, and public `/hotels` rendered catalog controls without the catalog-unavailable fallback. The catalog probe exercises the application's real server-side catalog client/key/schema checks without exporting the key. Empty published catalogs can pass; credentials/service failures cannot pass via the fallback page. Authentication/CSRF/cookie mutation regressions remain in CI; deployment creates no test accounts or bookings.

Inventory records the previous immutable API/Admin image references, pulls both images and runs only `inventory-release node dist/apps/api/src/cli.js indexes` from the new API image. The existing CLI calls `createCollection`/`createIndexes`, does not drop existing indexes, and uses `APP_ENV=staging`, `CONFIRM_ENVIRONMENT=staging` from the reviewed Compose release service. `INVENTORY_RELEASE_ENV_FILE` is fixed to `/etc/maqamstay-staging/inventory.env`; its VPS-only role must be approved for additive index provisioning. No profiles/seed/bootstrap runs. Index failure stops before recreation.

API health requires Docker health and **VPS-local** `http://127.0.0.1:4000/health/live` and `http://127.0.0.1:4000/health/ready`, both exactly **200**. Public health endpoints remain blocked; they are never required to return 200. External acceptance uses credential-free `GET https://maqamstay-api.169-58-95-12.sslip.io/api/v1/public/hotels`, exactly **401**, as established by `ServiceGuard` in `apps/api/src/public-api.ts` and the integration test `requires scoped service credentials`. This proves the DNS/TLS/allowed catalog route is reachable and its authentication remains enforced; it does not replace the internal readiness check or claim an authenticated catalog read.

Public security acceptance requires GET `/health/live`, `/health/ready`, `/docs`, `/docs-json`, `/api/v1/admin/hotels`, `/api/v1/auth/me` and `/api/v1/auth/login` on that catalog hostname to return exactly **404** with no redirect. Credential-free, empty-body POST/PUT/PATCH/DELETE to `/api/v1/public/hotels` must return exactly **405**, matching the existing GET-only catalog ingress policy maintained in Customer's `deploy/nginx/catalog-routes.inc` and Inventory's isolated ingress assertions in `scripts/verify-images.mjs` (401 catalog, 404 protected paths, 405 non-GET methods). No Nginx/allowlist change is needed. The same policy gates a recreated API and its rollback. Unexpected 200, redirects, auth leakage on protected paths, catch-all 404 on the allowed catalog route, transport/TLS failures and incorrect write denials fail acceptance. The wrapper sends no catalog key, session cookie or storage credential and disables implicit curlrc configuration. It emits only health booleans and constructed deployment evidence, never protected environment values or response bodies. GitHub Actions receives none of `MONGODB_URI`, `SESSION_SECRET`, the plaintext `catalog.read` key or storage credentials.

Admin health requires Docker health plus local `http://127.0.0.1:3100/login` and external `https://maqamstay-admin.169-58-95-12.sslip.io/login`, both **200**. The API's `/data/media` bind must still be writable, originate at `/opt/maqamstay-staging/data/media`, and preserve that host directory's device/inode. The script never creates, clears, replaces or deletes this media directory. It checks the existing mount before deployment and after API recreation/rollback. The existing Compose `create_host_path: false` regression remains.

Failed health or partially failed recreation restores previous immutable images using exactly the same service-scoped Compose command, then verifies health again. For pre-existing locally built applications, the recorded Docker image ID is accepted only as the retained rollback reference; new deployments always use a GHCR manifest digest. Retain those images locally. Customer restores Customer only. Inventory keeps an independently healthy new service and restores each failing service separately. An interrupted/unknown recreation restores every service touched whose health was not established. A failed rollback remains a failed workflow with per-service rollback evidence. No automatic database rollback, migration reset or index deletion is attempted; old images must be compatible with additive schema/index changes. Review expand/contract migrations before merging.

One-off release jobs have deterministic names. If a Docker client times out, the script removes **only that deployment's one-off release container**, preventing a mutation job from continuing after the lock is released. An interrupted migration/index operation requires manual review before retrying. Hard process termination, power loss or incompatible database changes cannot guarantee automatic recovery; the durable pre-mutation journal and retained old images support operator recovery. Inspect any `.pending` checkpoint before removing it; an existing pending file fails closed.

## Environment, secrets and evidence

Create GitHub Environment `staging` in each repository, restrict deployment branches to `staging`, and configure:

| Environment secret        | Purpose                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `STAGING_VPS_HOST`        | Verified staging host (currently `169.58.95.12`)                                                                        |
| `STAGING_VPS_USER`        | Dedicated restricted account, e.g. `maqamstay-deploy`                                                                   |
| `STAGING_VPS_SSH_KEY`     | Dedicated private deployment key, never generated/stored in this repository                                             |
| `STAGING_VPS_KNOWN_HOSTS` | OpenSSH known_hosts line(s), with host fingerprint independently verified through the VPS console/trusted administrator |

Do not put `DATABASE_URL`, `SESSION_SECRET`, Atlas URI, catalog keys or storage credentials in Actions. They remain in `/etc/maqamstay-staging/customer.env` and `/etc/maqamstay-staging/inventory.env`, with optional separate VPS-only release/PostgreSQL files. Private GHCR access uses an operator-provisioned read-only registry credential on the VPS, not an application/GitHub environment secret. Public packages can be pulled without it. Enable no environment required-reviewer rule if deployment must be fully automatic after CI; optional organizational approval rules will pause the job by design.

SSH rejects `root` as the deployment login and uses pinned known_hosts, strict host verification, one explicit identity, no password/interactive fallback, no agent forwarding and no port forwarding. The private key lives only in a mode-restricted runner temporary file and is cleaned on exit. Remote command output is limited to constructed JSON evidence; command logs/response bodies/config/environment values are suppressed. Docker inspect uses only selected fields, never full configuration. Source and browser scans are fail-closed gates for known credential/server-secret patterns; they do not replace repository review.

Successful publication artifacts record commit, full-SHA tags, immutable references and timestamp. Deployment artifacts and protected VPS journals record commit, tags/digests, timestamps, migration/index job result, previous digest per service, per-service health, rollback reference/health and overall status. Artifact retention is 90 days. Failed deployments upload evidence where a report was produced; failures before remote entry may have no remote report. Health bodies, release logs and secret values are never included.

See the separate [VPS setup guide](staging-vps-setup.md) for exact future operator steps. See [local verification](staging-cicd-verification.md) for what was actually run and what remains pending.

## Protected configuration and non-mutating validation

The exact non-secret contents below are also committed as `deploy/cicd/cicd.example.json`. They reflect the owner-supplied topology; no VPS inspection or installation was performed. Install through a separately authorized operator review, never by copying secrets into JSON.

```json
{
  "version": 2,
  "stateDirectory": "/var/lib/maqamstay-cicd",
  "minimumAvailableRamMiB": 512,
  "deployments": {
    "customer": {
      "repository": "shhassan699-maker/MaqamStay",
      "project": "maqamstay-customer-staging",
      "composeFiles": [
        "/opt/maqamstay-staging/customer/deploy/docker-compose.staging.yml",
        "/opt/maqamstay-staging/deployment/phase3b-customer.override.yml"
      ],
      "requiredProfiles": ["release"],
      "imagesFile": "/opt/maqamstay-staging/deployment/customer-images.env",
      "runtimeServices": ["customer"],
      "imageSelectors": {
        "customer": "CUSTOMER_IMAGE",
        "customer-release": "CUSTOMER_RELEASE_IMAGE"
      },
      "environmentFiles": {
        "CUSTOMER_ENV_FILE": "/etc/maqamstay-staging/customer.env",
        "CUSTOMER_RELEASE_ENV_FILE": "/etc/maqamstay-staging/customer-release.env",
        "POSTGRES_ENV_FILE": "/etc/maqamstay-staging/postgres.env"
      },
      "lockFile": "/var/lib/maqamstay-cicd/deploy.lock",
      "databaseService": "postgres",
      "release": {
        "service": "customer-release",
        "imageSelector": "CUSTOMER_RELEASE_IMAGE",
        "command": ["npm", "run", "db:migrate"]
      },
      "health": {
        "profile": "customer-crm-v1",
        "localOrigin": "http://127.0.0.1:3000",
        "publicOrigin": "https://maqamstay-staging.169-58-95-12.sslip.io",
        "crmOrigin": "https://maqamstay-crm.169-58-95-12.sslip.io"
      },
      "media": null
    },
    "inventory": {
      "repository": "shhassan699-maker/MaqamStay-Inventory-Admin",
      "project": "maqamstay-staging",
      "composeFiles": [
        "/opt/maqamstay-staging/inventory/deploy/docker-compose.staging.yml"
      ],
      "requiredProfiles": ["release"],
      "imagesFile": "/opt/maqamstay-staging/deployment/inventory-images.env",
      "runtimeServices": ["inventory-api", "inventory-admin"],
      "imageSelectors": {
        "inventory-api": "INVENTORY_API_IMAGE",
        "inventory-admin": "INVENTORY_ADMIN_IMAGE"
      },
      "environmentFiles": {
        "INVENTORY_API_ENV_FILE": "/etc/maqamstay-staging/inventory.env",
        "INVENTORY_RELEASE_ENV_FILE": "/etc/maqamstay-staging/inventory.env"
      },
      "lockFile": "/var/lib/maqamstay-cicd/deploy.lock",
      "databaseService": null,
      "release": {
        "service": "inventory-release",
        "imageSelector": "INVENTORY_API_IMAGE",
        "command": ["node", "dist/apps/api/src/cli.js", "indexes"]
      },
      "health": {
        "profile": "inventory-catalog-v1",
        "localApiOrigin": "http://127.0.0.1:4000",
        "localAdminOrigin": "http://127.0.0.1:3100",
        "publicAdminOrigin": "https://maqamstay-admin.169-58-95-12.sslip.io",
        "publicCatalogOrigin": "https://maqamstay-api.169-58-95-12.sslip.io"
      },
      "media": {
        "hostPath": "/opt/maqamstay-staging/data/media",
        "containerPath": "/data/media"
      }
    }
  }
}
```

The forced SSH boundary accepts exactly `validate customer <full-40-character-sha>` or `validate inventory <full-40-character-sha>`, as well as the existing `deploy <customer|inventory> <sha> <digest-1> <digest-2>`. Validation requires no digests or application credentials. It validates the entire JSON schema, then checks only the selected deployment's protected files, selectors, effective Compose topology (`config --quiet` plus captured JSON), current Docker health, disk/RAM, PostgreSQL identity for Customer or media/network identity for Inventory. It returns sanitized JSON and an unsuccessful status on failure.

Validation takes the same lock but performs **no pulls, selector/config edits, journal writes, migrations, indexes, container recreation, Docker exec, HTTP probes, Nginx command/reload or database writes**. It deliberately inspects existing Docker health only, so it is not a substitute for full deployment HTTP/TLS acceptance. Mutation methods also reject calls in validation mode. Missing lock/files or unsafe ownership fail closed. No `eval`, shell access, client-controlled paths/services or new sudo permissions are introduced.

## Required Compose release profile and selector baseline

Both protected definitions now require `requiredProfiles: ["release"]`. This is an explicit required field in the version-2 schema; only this exact reviewed profile list is allowed. Missing/empty/duplicate lists, alternate names, invalid types, extra fields and SSH profile arguments fail closed. Update the protected JSON together with the matching engine; older documents without this field are intentionally rejected. The exact JSON Patch delta is:

```json
[
  {
    "op": "add",
    "path": "/deployments/customer/requiredProfiles",
    "value": ["release"]
  },
  {
    "op": "add",
    "path": "/deployments/inventory/requiredProfiles",
    "value": ["release"]
  }
]
```

Preflight in both deploy and validation modes includes `--profile release` in `config --quiet` and the captured `config --format json`. Customer must still contain exactly `customer`, `postgres`, `customer-release`; Inventory exactly `inventory-api`, `inventory-admin`, `inventory-release`. A missing release service still fails. JSON rendering can contain protected env values: the wrapper captures it only in memory and never prints it. The quiet render commands are:

```bash
CUSTOMER_ENV_FILE=/etc/maqamstay-staging/customer.env CUSTOMER_RELEASE_ENV_FILE=/etc/maqamstay-staging/customer-release.env POSTGRES_ENV_FILE=/etc/maqamstay-staging/postgres.env docker compose --project-name maqamstay-customer-staging --env-file /opt/maqamstay-staging/deployment/customer-images.env -f /opt/maqamstay-staging/customer/deploy/docker-compose.staging.yml -f /opt/maqamstay-staging/deployment/phase3b-customer.override.yml --profile release config --quiet
INVENTORY_API_ENV_FILE=/etc/maqamstay-staging/inventory.env INVENTORY_RELEASE_ENV_FILE=/etc/maqamstay-staging/inventory.env docker compose --project-name maqamstay-staging --env-file /opt/maqamstay-staging/deployment/inventory-images.env -f /opt/maqamstay-staging/inventory/deploy/docker-compose.staging.yml --profile release config --quiet
```

These commands require the selected protected env-path selectors supplied by the host engine or the existing selector file. Do not source runtime secrets into an operator shell. The engine also enables the required profile for the explicit one-off `run --rm --no-deps` release job, which is never invoked in validation mode. Runtime `up` and container lookup commands do **not** enable profiles. Every `up` still names exactly one permitted runtime service with `--no-deps --no-build --pull never --force-recreate`. Release services never become persistent applications; PostgreSQL stays check-only. Validation retains zero application/config/database mutation and never normalizes selectors.

The owner-reported Customer mode `0644` and mutable local tags are separate, intentional validation blockers. They are not accepted by this fix. Required operational ownership/mode for each selector is **root:root, 0600**, regular non-symlink file, one hard link, with root-owned non-symlink ancestors that are not group/world-writable. Precisely, the unchanged file checker enforces UID 0, regular file/non-symlink, no group/other permission bits (`mode & 0077 == 0`) and no multiple hard links. It accepts stricter owner-only modes such as `0400`; it does not separately test GID or require an exact owner-bit mask. Setup and the normalization example explicitly establish root:root/0600. Group/world-readable or writable modes, non-root ownership, symlinks, hard links or unsafe ancestors fail before Docker operations. No ACL-based alternative or writable deployment-user ownership is introduced.

The unchanged selector parser accepts only:

- `sha256:<64 lowercase hexadecimal characters>`: retained, locally available Docker image ID, including an already-running local Customer image and its installed release image.
- `ghcr.io/shhassan699-maker/<matching-image-name>@sha256:<64 lowercase hexadecimal characters>`: immutable registry manifest digest for that exact selector's image name.

Matching names are `maqamstay-customer` for `CUSTOMER_IMAGE`, `maqamstay-customer-release` for `CUSTOMER_RELEASE_IMAGE`, `maqamstay-inventory-api` for `INVENTORY_API_IMAGE`, and `maqamstay-inventory-admin` for `INVENTORY_ADMIN_IMAGE`. Mutable local tags, `latest`, full commit-SHA registry tags, other registries/names, uppercase or shortened hashes are rejected. A full commit-SHA tag is a naming convention and can be retargeted in a registry; a manifest digest addresses content. Local Docker image IDs and registry manifest digests identify different objects: never construct a GHCR digest reference by prefixing the captured local image ID. Future new deployments still pull/deploy only published GHCR digests; local IDs are retained-baseline/rollback references. Keep those local images and do not prune them.

See the exact future administrator-only normalization procedure in [staging-vps-setup.md](staging-vps-setup.md#future-customer-selector-baseline-normalization). It changes only Customer selector metadata/content and a protected backup; it performs no container/storage/database mutation. It cannot be requested through forced SSH validation/deployment and does not touch Inventory selectors.
