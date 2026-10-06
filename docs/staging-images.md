# Staging images and deployment preparation

Phase 1 prepares source, isolated verification and review branches only. No VPS connection, deployment, database mutation, DNS, certificate, Atlas or S3 provisioning is performed.

## Source and image ownership

Customer is based on approved commit 5669a2ce51145ba702c7ce01786ed3a27a834496; Inventory is based on 3a68c24270cb9fa8cde2497e1e542d60f9e23d7a. Keep sibling checkouts under /srv/maqamstay/staging/customer and /srv/maqamstay/staging/inventory. Customer owns PostgreSQL/Prisma; Inventory owns Atlas. Neither shares database credentials with the other.

| Image                                                | Dockerfile / target               | Process                                  |
| ---------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| ghcr.io/shhassan699-maker/maqamstay-customer         | deploy/Dockerfile / runtime       | next start, 3000                         |
| ghcr.io/shhassan699-maker/maqamstay-customer-release | deploy/Dockerfile / release       | Inert default; explicit operator tooling |
| ghcr.io/shhassan699-maker/maqamstay-inventory-admin  | Inventory deploy/admin.Dockerfile | next start, 3100                         |
| ghcr.io/shhassan699-maker/maqamstay-inventory-api    | Inventory deploy/api.Dockerfile   | Nest API, 4000                           |

All Node images retain USER node. Base Node 24 bookworm-slim is pinned by registry manifest digest, with npm ci lockfiles. There is no standalone Next output. Customer config is compiled to JavaScript before runtime dependencies are pruned. Release includes Prisma CLI, schema/migrations, tsx and bootstrap source; runtime excludes bootstrap tooling/source. Current public font builds need Google font network access. Image digests, not repeated rebuilds, define a release.

## Environment and secret boundaries

| Service          | Build configuration                                                                                            | Runtime only                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer         | NEXT_PUBLIC_SITE_URL=https://staging.maqamstay.com; NEXT_PUBLIC_WHATSAPP_NUMBER=verified public support number | DATABASE_URL; its own SESSION_SECRET; INVENTORY_API_URL=https://inventory-api-staging.maqamstay.com; INVENTORY_CATALOG_API_KEY; INVENTORY_TIMEOUT_MS=5000                                                                |
| Customer release | No secrets or public configuration required                                                                    | Separate migration DATABASE_URL; ADMIN_EMAIL/NAME/PASSWORD only during explicit bootstrap                                                                                                                                |
| Admin            | ADMIN_API_ORIGIN=http://inventory-api:4000                                                                     | NODE_ENV=production; the same ADMIN_API_ORIGIN                                                                                                                                                                           |
| API              | None                                                                                                           | NODE_ENV=production; APP_ENV=staging; MONGODB_URI; SESSION_SECRET; exact ADMIN_APP_URL/CORS_ALLOWED_ORIGINS; pool/rate/log settings; trusted connecting proxy CIDRs; STORAGE_DRIVER=s3 and private storage configuration |
| PostgreSQL       | Pinned image only                                                                                              | POSTGRES_DB=customer_staging; POSTGRES_USER; POSTGRES_PASSWORD                                                                                                                                                           |

Only customer site URL and support number are public build arguments. Admin origin is a non-secret server rewrite configuration, fixed at build time. Never pass DATABASE_URL, SESSION_SECRET, catalog keys, storage keys or bootstrap credentials to builds, Git, browser bundles or build caches. Optional customer analytics remain unset in these staging images.

Customer catalog credentials have catalog.read scope only and stay server-side. No Mongo credentials enter the customer service. API storage keys remain API-only, with private bucket permissions. A Contabo VPS does not automatically have an AWS workload identity.

Use separate runtime/provisioning DB users. PostgreSQL initialization alone does not create the least-privilege customer runtime role; provision it later under explicit database administration authorization. Local PostgreSQL private bridge traffic can use sslmode=disable; managed/external PostgreSQL requires verified TLS. Atlas always requires authenticated TLS and a database name ending _staging. Runtime Mongo verifies pre-provisioned indexes. SESSION_SECRET changes invalidate derived inventory sessions/service credentials.

Actual environment files belong outside either checkout, with restricted ownership/permissions. deploy/images.env.example contains non-secret references only. Runtime env files never enter build contexts. Compose env_file is not an encrypted secret manager: authorized Docker administrators can inspect container environments. Do not print docker inspect output or compose config without --quiet once real secrets exist.

## Networking and proxy

Combine both repository-controlled Compose files into one named project. Customer joins maqamstay_customer_app and maqamstay_customer_db; PostgreSQL joins only the internal customer DB network. Admin/API join maqamstay_inventory_app. No Inventory container joins the customer DB network.

Only application host bindings are 127.0.0.1:3000, 127.0.0.1:3100 and 127.0.0.1:4000. PostgreSQL has no host port. Processes bind container interfaces; the host bindings enforce loopback access. Review Docker firewall behavior and IPv6/direct-routing settings during the later VPS audit.

Use existing host Nginx after inspection. deploy/nginx/staging.conf.template is a review template, not an installation script. It assumes already-provisioned certificates and includes copied snippets at /etc/nginx/maqamstay. Preserve existing virtual hosts/default host rejection and never replace the global Nginx configuration. Consider restricting staging/admin access to approved operator networks in the later infrastructure phase.

Catalog hostname accepts exactly seven documented GET route patterns, including hotel detail/nearby and approved media. All other paths return 404; every other method, including HEAD, returns 405. No auth/admin/docs/health routes are published on this hostname. Cookie/Authorization/Origin/CSRF headers are stripped on catalog forwarding; only X-API-Key is forwarded. Forwarded IP is overwritten at the edge. Configure API trusted CIDRs for actual host/bridge/admin peers after topology inspection, never trust arbitrary /0 networks. No proxy caching is enabled.

## CI and GHCR

CI uses GitHub-hosted Ubuntu runners with pinned action commits and Node 24.12.0. Both repositories run install, lint, strict typecheck, formatting, unit/integration tests and production builds. Inventory additionally builds the pinned customer checkout, runs Chromium publishing workflows and scans both browser bundles.

Disposable image tests build all four images across the two workflows, validate USER node, tmp/cache writes, image history/config/canary exclusion and loopback HTTP checks. Inventory uses a new temporary Mongo replica container and test-named loopback database; it shares that temporary network namespace with the API so the existing test URI guard remains intact. Local test storage is under /tmp. It tests the real private admin rewrite and the Nginx route snippets using an HTTP-only harness: no certificates are generated. No CI job receives staging/production credentials or invokes mutation CLIs.

Restore tests are deliberately excluded from this workflow: no unverified Database Tools installer or real database is used. Existing restore rehearsal remains available for a separately provisioned isolated CI job.

publish-images.yml is workflow_dispatch only, after reusable CI passes. It uses GITHUB_TOKEN packages:write and environment ghcr-staging-publication. Before first manual publication, repository owners must configure environment reviewers and allowed branches, verify GHCR package visibility/access, and approve the source commit. Publication does not access the VPS, execute migrations or create application credentials.

Published tags are the full github.sha; each matrix job uploads image-digest.json containing the tag, commit and immutable registry reference. Copy only reviewed @sha256 references into the coordinator file. CI push checks build images locally on the runner; they do not publish them. No image has been published by preparing this workflow. Workflow dispatch becomes available after normal reviewed adoption on the default branch.

## Future deployment order — DO NOT execute during Phase 1

1. Complete the read-only VPS audit and resolve resource, existing-vhost, Docker, SSH/firewall and backup prerequisites.
2. Review/merge source branches normally; enable CI/publication controls. Manually publish approved commits and record four digests.
3. Separately provision staging Atlas/private S3, runtime/release identities, off-host backups and protected runtime configuration. Verify HTTPS DNS/certificates under a later approval.
4. Review the combined configuration with non-secret image references and private env-file paths:

```bash
docker compose --project-name maqamstay-staging --env-file /srv/maqamstay/staging/deployment/images.env -f /srv/maqamstay/staging/customer/deploy/docker-compose.staging.yml -f /srv/maqamstay/staging/inventory/deploy/docker-compose.staging.yml config --quiet
```

5. Pull reviewed digests, start private PostgreSQL, provision its separate runtime role, and execute the explicit customer release migration:

```bash
# Commands below are future operator jobs, not Phase 1 actions.
# Use the same project/env/file flags shown above for each Compose command.
docker compose ... run --rm customer-release npm run db:migrate
docker compose ... run --rm customer-release node --import tsx scripts/create-admin.ts
```

The customer bootstrap command uses injected runtime environment rather than the existing local --env-file=.env npm helper. It upserts an account and may reset an existing account's password; verify the intended email first and remove temporary ADMIN_PASSWORD afterward.

6. Using separate Inventory release credentials and CONFIRM_ENVIRONMENT=staging, run:

```bash
docker compose ... run --rm inventory-release node dist/apps/api/src/cli.js indexes
docker compose ... run --rm inventory-release node dist/apps/api/src/cli.js profiles
docker compose ... run --rm inventory-release node dist/apps/api/src/cli.js admin
```

profiles is an existing-data backfill; indexes precedes API startup; admin uses temporary ADMIN_* injection only. Never seed real production data, use a runtime identity for DDL or run these jobs implicitly during startup.

7. Start API and verify /health/live and /health/ready locally. Start Admin with its baked private rewrite, then Customer. Verify the customer runtime HTTPS origin and create a dedicated catalog.read key through authorized Inventory administration; inject it into the customer server only.
8. Validate reviewed Nginx changes alongside existing vhosts, then activate ingress during the separately approved infrastructure phase. Run node deploy/health-check.mjs locally on the host and HTTPS smoke/browser tests, publication/unpublish, private-media denial, auth/CSRF, exact catalog allowlist and bundle scans.
9. Record commit/digests, probes, backup/restore evidence and configuration versions before accepting staging.

The ellipsis in job examples abbreviates the previously shown flags; it is not a literal runnable command. No script here installs Nginx, modifies firewall/SSH, provisions cloud resources or deploys remotely.

## Rollback and backups

Keep the previous four image digests, matching non-secret configuration and additive database compatibility information. Restore previous image references and recreate only these staging application services after operator approval. Check readiness and catalog behavior before reopening ingress. Customer public values and Admin origin are baked: rolling back requires the corresponding built image.

Do not use docker compose down -v, drop indexes, remove PostgreSQL volumes, restore over live data, reset Git branches or restore revoked credentials to roll back application code. Stop and investigate incompatible migrations; database rollback is a separate reviewed recovery procedure.

Use encrypted off-VPS PostgreSQL dumps/appropriate PITR, Atlas snapshots/PITR supported by the chosen tier, and private object version recovery. Test isolated restoration, including media and audit consistency. Local prior restore evidence does not establish Atlas/S3/VPS recovery readiness.

## Phase 1 evidence

Consult GitHub CI for actual Linux image verification and local gate results in the accompanying verification report. Templates are prepared; Docker availability, CI runner access and any failed job must be reported explicitly rather than treated as a passing container test.
