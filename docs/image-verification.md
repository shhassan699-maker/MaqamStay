# Phase 1 verification diagnosis and procedures

This preparation stays on local Windows and the two `feature/staging-images` review branches. Do not use Contabo as a runner, publish images, merge branches, load real environment files or run deployment/release mutation commands.

## Diagnosis

All four workflow files pass actionlint (YAML, GitHub expressions, action input and reusable-workflow checks). Both repository Actions settings are enabled with all actions allowed. Customer's workflow is registered. Its [run at bb0c7537](https://github.com/shhassan699-maker/MaqamStay/actions/runs/37454899643) has zero steps and the annotation: "The job was not started because your account is locked due to a billing issue."

Inventory's [run at 6fb98207](https://github.com/shhassan699-maker/MaqamStay-Inventory-Admin/actions/runs/37455001809) is `startup_failure`, path `BuildFailed`, with no jobs/check-run diagnostic and no registered workflows returned by the API. Static validation identifies no YAML/configuration cause. The same owner has a confirmed account lock; that is an infrastructure blocker, but the available evidence does not establish Inventory's specific startup cause. Recheck after the account lock is resolved; if it still fails before jobs, contact GitHub Support with this run URL and do not change tests speculatively.

**ACCOUNT / GITHUB ACTION REQUIRED:** the owner resolves billing/account restrictions through GitHub's billing UI or Support. Repository code, permissions escalation, a VPS runner or self-hosting must not be used to bypass that restriction. [GitHub Actions billing guidance](https://docs.github.com/en/actions/concepts/billing-and-usage).

**CODE FIX REQUIRED:** both container verifiers used an over-escaped filename regex inside a generated JavaScript string. This could skip `.js` browser assets. The shared checker now serializes a tested function, inspects `.js` and `.map`, fails on zero inspected assets, and rejects secret names/canary values. Source-level bundle scanners already used correct patterns; their earlier results remain separate evidence. Four regression tests cover scanner leaks, remote-daemon rejection, permitted engines, port leaks and image secret bindings. The customer CI runs these before image checks. Explicit Windows `--mode windows` (also accepting legacy `--local`) and Linux `--mode linux` use the same image assertions as hosted CI. Do not spoof GitHub environment flags. See `image-portability.md` for the lockfile/toolchain repair and supported Linux procedure.

## Workflow review

| Item                       | Result                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workflow locations         | `.github/workflows/ci.yml` and `publish-images.yml` in each real repository; no nested workflow paths                                                                                                                                |
| Triggers                   | CI on `main`, exact `feature/staging-images`, pull requests and reusable calls; publication only manual dispatch                                                                                                                     |
| Checkout/build paths       | Customer at checkout root; Inventory at `inventory`, pinned public customer fixture at `customer`; overrides match sibling paths                                                                                                     |
| Permissions                | CI `contents: read`; publication job `contents: read` + `packages: write`; no VPS/database secrets supplied                                                                                                                          |
| Reusable dependencies      | Publication `needs: verify`; same-commit reusable CI; no inherited application secrets required                                                                                                                                      |
| Buildx                     | Pinned setup action; `docker build` produces locally loaded images for verification; pinned build/push action uses Buildx for future publication                                                                                     |
| Publication environments   | `ghcr-staging-publication` currently absent in both repos (API 404). Reviewers/allowed branches and GHCR package access/visibility must be configured before future publication; absence does not block CI                           |
| Browser dependencies       | Builds both products; Playwright installs Chromium and OS dependencies; `mongodb-memory-server` creates temporary Mongo 8.0.17 replica set; no PostgreSQL/Atlas/S3 connection                                                        |
| Restore dependencies       | No restore CI job is enabled. Native `mongodump`/`mongorestore` are not provisioned by these workflows; restore coverage is not claimed. Add only after verified native-tool provisioning and isolated source/destination test setup |
| Local runtime dependencies | Node, Git, `tar`, Docker Desktop Linux engine on Windows or local Unix Docker on Linux, Compose v2 and Buildx; public registry/npm/font downloads during builds                                                                      |

The browser build's `ADMIN_API_ORIGIN=http://127.0.0.1:4000` is deliberate for its local QA server. The Admin **image** builds with `http://inventory-api:4000`; it checks the baked manifest and exercises that private rewrite. Changing the browser origin to Docker DNS would break the host-based browser stack.

## Path A — GitHub-hosted runners (preferred)

1. Resolve the owner's account/billing lock. Confirm Actions remains enabled and the pinned GitHub/Docker actions are allowed. Do not change application credentials or grant CI broad write permissions.
2. On each repository's Actions page, choose the CI run for the current review SHA and **Re-run all jobs** when available. For Inventory's startup-only run, re-run if offered; otherwise the next normal review-branch push or pull-request event triggers validation. No main merge or publication workflow is needed.
3. Verify the run identifies the intended SHA and starts the `verify` job on `ubuntu-24.04`. If Inventory still has only `BuildFailed`, retain the run URL and ask Support for the startup diagnostic.
4. Require npm install/audit, lint, strict TypeScript, formatting, tests, production builds, bundle checks and four container checks to succeed. Inventory additionally installs/runs Chromium browser tests and checks combined Compose/Nginx routing.
5. Record the run URLs, source SHAs and container-check results. CI uses locally tagged images only and does not log in to GHCR, publish, migrate or deploy. Do **not** trigger `publish-images.yml` in this phase.

## Path B — local Windows Docker Desktop

Install Docker Desktop manually using the [official Windows procedure](https://docs.docker.com/desktop/setup/install/windows-install/), meeting its virtualization/Windows/backend prerequisites. Use Linux containers and the local `desktop-linux` context. This task has not installed Docker or changed Windows features. Allocate enough disk/RAM for four image builds and disposable Mongo/Nginx; close unrelated workloads if needed. Do not point Docker at an SSH/TCP daemon or a production engine.

After installation/startup, run in local PowerShell:

```powershell
Set-Location 'C:\Users\hp\OneDrive\Desktop\MaqamStay'
docker context show
docker context inspect desktop-linux --format '{{.Endpoints.docker.Host}}'
# Expected: npipe:////./pipe/dockerDesktopLinuxEngine
# If needed, select this LOCAL context manually:
docker context use desktop-linux
docker version
docker compose version
docker buildx version
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 13000,13100,14000,18080 } |
  Select-Object LocalAddress,LocalPort,OwningProcess
node deploy/verify-local-images.mjs --help
node deploy/verify-local-images.mjs
```

The four test ports must be free. Windows mode rejects endpoint/builder environment overrides and remote/non-Desktop engines; Linux mode accepts only a local Unix daemon; resolve local shell configuration manually without printing secrets. It never changes a context itself. Both repositories must be clean with intended changes committed. Never reset uncommitted work to meet that requirement.

The coordinator exports **committed Git files only** into separate temporary customer/inventory folders, strips inherited application environment values, adds disposable canaries, and runs these exact builds there:

```text
docker build -f deploy/Dockerfile --target runtime --build-arg NEXT_PUBLIC_SITE_URL=https://staging.maqamstay.com --build-arg NEXT_PUBLIC_WHATSAPP_NUMBER=10000000000 -t <unique-local-customer-tag> .
docker build -f deploy/Dockerfile --target release -t <unique-local-release-tag> .
docker build -f deploy/admin.Dockerfile --build-arg ADMIN_API_ORIGIN=http://inventory-api:4000 -t <unique-local-admin-tag> .
docker build -f deploy/api.Dockerfile -t <unique-local-api-tag> .
```

It then invokes `deploy/verify-images.mjs --local` in the temporary customer checkout and `scripts/verify-images.mjs --local` in the temporary Inventory checkout with `CUSTOMER_ROOT` pointing to its customer sibling. These are the CI verifier entry points with identical assertions. Do not set `CI`/`GITHUB_ACTIONS` to bypass guards or run a staging Compose stack to test images.

Runtime networks are newly named normal bridges so Docker 29 can publish loopback probes. Test-only Node connection guards allow exact generated fixture endpoints and reject other dependency sockets/DNS lookups; the HTTPS catalog hostname resolves only to fixture loopback. Mongo binds loopback in its own temporary namespace; Nginx has only the loopback API upstream. This is dependency isolation, not an air-gapped bridge. No host firewall changes are made. Offline probes use `--network none`. Customer retains the required HTTPS inventory setting with a generated unused key; no real PostgreSQL is needed for the root-page smoke check. API uses `NODE_ENV=test`, `APP_ENV=test`, a generated session secret, local `/tmp` media and a new Mongo replica set at loopback within a shared **temporary** network namespace. Atlas/S3 are never used. Mongo port 27017 is not published. The Nginx harness is HTTP-only on loopback and creates no certificates.

Successful execution writes a non-secret `%TEMP%\maqamstay-four-image-test-*-evidence.json` with source commits and **local image IDs**, not GHCR digests. Temporary test containers, their anonymous volumes, networks, archives and env files are removed after ownership verification. Cleanup failures fail verification. Newly built unique local image tags remain for inspection; existing resources are untouched. A failure must be corrected and re-run, never recorded as a pass. Docker build/test errors may remain pending until Docker is available.

## Four-image acceptance checklist

| Image            | Required assertions                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer runtime | Build; `USER node`/actual non-root UID; writable cache and `/tmp`; internal 3000 / loopback 13000 GET `/`; only expected host mapping; HTTPS inventory setting; `.js`/`.map` secret scan; image environment/history/canary checks |
| Customer release | Build; non-root; `/tmp`; Prisma CLI/native-engine version; compiled bootstrap exists and development ESLint absent; no database mutations, listener or host ports; environment/history/canary checks                              |
| Inventory Admin  | Build with private origin; non-root; cache and `/tmp`; internal 3100 / loopback 13100 GET `/login`; baked rewrite + forwarded API 401; only expected mapping; browser/image secret checks                                         |
| Inventory API    | Build; non-root; actual running root filesystem read-only and `/tmp` writable; internal 4000 / loopback 14000 GET `/health/live` and `/health/ready`; isolated Mongo/local storage; no DB host port; image secret checks          |

Additional required checks: combined Compose network/port isolation, real Nginx snippet `nginx -t`, allowed catalog routes reaching the API, all other paths denied, and non-GET methods denied. No publication/migration/bootstrap is part of acceptance.

Phase 1 is **not complete** until one supported path executes all required gates and records successful four-image evidence. Static validation and scanner regression tests cannot establish container runtime success.
