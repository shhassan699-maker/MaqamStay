# Image portability repair

This work changes source on the two `feature/staging-images` review branches only. It does not connect to a VPS, deploy, publish images, change infrastructure or execute database release jobs.

## Dependency reproducibility

The digest-pinned Node image contains **Node 24.21.0 and npm 11.19.0**. These versions were checked against the actual public image metadata and npm package in its Linux layer, without a Docker daemon. A checksum-verified portable official Node distribution supplied the same versions for clean local installation.

Before repair, npm 11.19.0 rejected the customer lock for missing `@emnapi/runtime@1.11.3` and `@emnapi/core@1.11.3`; it rejected Inventory for missing `@emnapi/runtime@1.11.3`. Committed optional Sharp/Tailwind WASM packages declared these dependencies without corresponding resolved lock entries. Existing nested 1.10.0 entries did not satisfy the newer ranges. npm 11.19.0 lock consistency checks include optional cross-platform dependencies, so missing entries can fail installation even when those packages are not installed on Windows/Linux. The older local npm had accepted the incomplete locks. The exact historical command which originally produced them is unknown; no provenance is invented.

Both locks were repaired in clean source exports using `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, followed by actual fresh `npm ci` under npm 11.19.0. No manifest requirements or existing resolved package versions changed. Customer adds eight package locations, including the required optional WASM dependencies; Inventory adds one runtime location. npm also normalizes peer metadata and Inventory's previous four-space lock indentation. These are npm-generated changes, not hand-edited JSON.

Dockerfiles and CI explicitly verify both Node/npm versions before installation. Regression tests check optional @emnapi references independently of installed dependencies. `npm ci --dry-run --ignore-scripts --os=linux --cpu=x64` additionally validates Linux dependency resolution; this is not a Linux native build or container execution.

Production audits remain required. Customer's existing five high development-only ESLint/braces findings remain documented in `staging-images-verification.md`; no framework downgrade or broad audit fix is used. Inventory's full and production audits have no findings.

## Supported coordinator modes

Prerequisites: clean committed independent checkouts, Git, tar, Node, local Linux Docker engine, Compose v2, Buildx, sufficient temporary disk space and free loopback ports 13000/13100/14000/18080. Build downloads require network access. No application environment files are used. The coordinator exports committed sources as tar with Git newline conversion disabled, so Windows archives cannot contaminate Linux scripts with CRLF.

Windows Docker Desktop (select `desktop-linux` manually):

```powershell
node deploy/verify-local-images.mjs
```

Linux local Docker (run from the customer checkout; supply the independent Inventory checkout path when it is not nested):

```bash
node deploy/verify-local-images.mjs --mode linux /absolute/path/to/MaqamStay-Inventory-Admin
```

Linux mode requires Linux and `unix:///var/run/docker.sock`. SSH/TCP daemons and Docker/Buildx environment overrides are rejected before daemon use; the script never changes context. GitHub-hosted CI retains its explicit hosted-runner guard. Do not use a production VPS as a CI runner or to bypass a GitHub billing restriction. Any later operator-approved Linux verification has the same disposable-only behavior.

The coordinator strips inherited application environment values, exports sibling clean source copies, builds four unique local images, verifies them and records both source SHAs plus local image IDs. It never logs into GHCR, pushes images, runs migrations or deploys. Existing containers/networks/volumes are not used. Local image tags are retained for inspection, while temporary containers, anonymous volumes, networks and generated configuration are removed.

## Docker 29 fixture networking

Fixture networks use dedicated normal bridges, not `--internal` bridges, because Docker 29 blocks the required host-published probes on an internal bridge. Every test host mapping is exactly `127.0.0.1`; Mongo has no host port. Network membership and actual Docker port bindings are asserted.

The customer retains `INVENTORY_API_URL=https://inventory-api-staging.maqamstay.com` with a generated unused key. A test-only mounted Node preload maps that hostname to fixture loopback and blocks dependency connections/DNS lookups outside loopback and the exact owned API bridge address. Admin's private rewrite remains `http://inventory-api:4000`. API uses a new single-node replica set at loopback in its owned Mongo namespace, a test-named DB, generated session secret and local `/tmp` media. Mongo listens only on loopback and its shell telemetry is disabled. Nginx uses only the namespace's loopback API upstream. The preload is never baked into application images or used in staging configuration.

Normal bridges have a default outbound route; this is not a network air gap. Node dependency sockets fail closed under the guard, with both a real loopback HTTP regression and container assertions for prohibited endpoints. No real external database/storage credentials or endpoints are supplied to the native fixtures. No host firewall/daemon/network policy is modified.

Task-specific names and an ownership label gate cleanup. Only exact matching labelled resources may be removed. Container cleanup includes their anonymous volumes; no prune operation runs. Cleanup failure fails verification instead of silently passing. Offline image probes still use `--network none`. Source and container browser scans reject missing/empty bundles, secret names and source-map leaks.

## Initial staging resource budget

Service-level `mem_limit` and `cpus` apply to Docker Compose v2 without requiring Swarm:

| Service         | Memory  | CPUs |
| --------------- | ------- | ---- |
| Customer        | 768 MiB | 0.5  |
| Inventory Admin | 768 MiB | 0.5  |
| Inventory API   | 768 MiB | 0.5  |
| PostgreSQL      | 1 GiB   | 0.5  |

Total application/database ceiling is 3.25 GiB and 2 CPU equivalents, excluding host/proxy/Docker overhead and separately invoked one-off release jobs. These are initial staging ceilings, not proof of throughput. Monitor OOM/latency/DB behavior before changing limits. Release-profile jobs retain their inert defaults and are outside this phase.

Combined Compose verification checks normalized limits, all three loopback application ports, no PostgreSQL publication, internal customer DB networking and Inventory exclusion from `customer_db`. Static YAML regression coverage runs without Docker; normalized Compose and Nginx execution still require Docker.

## Repeat verification

Run the supported coordinator only after both review commits are available and checkouts are clean. All four builds, non-root/cache/tmp/read-only checks, health endpoints, private rewrite, bundle/image history scans, combined Compose and Nginx allowlist must pass. Local source gates do not establish image runtime success. Consult `staging-images-verification.md` for actual evidence and remaining blockers.
