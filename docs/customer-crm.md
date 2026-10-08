# Shared Customer application: separate CRM hostname

The public website and Customer CRM use one Next.js application/container on `127.0.0.1:3000`, one release image and the same existing PostgreSQL database. No new repository, database, migration or CRM application is required. Inventory Admin and Inventory API remain independent; their configuration and virtual hosts are unchanged.

## Configuration

| Variable                                     | Staging value                                     | Ownership                                                                 |
| -------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                       | `https://maqamstay-staging.169-58-95-12.sslip.io` | Public build argument; retain the same value at runtime                   |
| `CUSTOMER_CRM_ORIGIN`                        | `https://maqamstay-crm.169-58-95-12.sslip.io`     | Server-only runtime configuration; never a public variable/build argument |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`                | Existing approved public support number           | Public build argument                                                     |
| `DATABASE_URL`                               | Existing private Customer PostgreSQL connection   | Runtime secret; unchanged database                                        |
| `SESSION_SECRET`                             | Existing Customer session/rate-limit secret       | Runtime secret; do not rotate for this change                             |
| `INVENTORY_CATALOG_API_KEY`                  | Existing scoped `catalog.read` credential         | Runtime secret; server-to-server use only                                 |
| `INVENTORY_API_URL` / `INVENTORY_TIMEOUT_MS` | Existing HTTPS catalog origin / `5000`            | Server runtime configuration; unchanged                                   |

Production requires distinct, exact HTTPS origins, without paths, credentials, queries or trailing slashes. Missing/invalid host configuration returns a generic 503 before application routing. Development/test can omit `CUSTOMER_CRM_ORIGIN` to retain the existing single-host development experience. A separate local CRM origin can be set explicitly.

`NEXT_PUBLIC_SITE_URL` is compiled into the build. Changing only the runtime environment cannot move a previously built public site to the sslip hostname. Rebuild with the table's public origin, then keep that same value in the runtime file. CRM origin is read at runtime and does not enter browser bundles. Quote share links, SEO and public WhatsApp flows retain the public site origin.

## Routing and authentication

On the public host, GET/HEAD `/admin` and `/admin/*` redirect with 307 to the configured CRM origin, retaining path/query. Other methods on those pages return 405. `/api/admin` and descendants return 404 without redirecting, regardless of method or supplied cookie. Normal public routes and request/quote-interest/catalog APIs continue on the public host.

On CRM, `/` redirects to `/admin`; `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`, `/_next/static/*`, `/_next/image`, `/brand-mark.svg`, `/icon.svg` and `/favicon.ico` are permitted. Other public pages/APIs return 404. The existing admin layout and API guards still validate persisted, active, unexpired sessions; cookie presence in Proxy is only an early navigation check. Unknown hosts fail closed. Incoming `X-Forwarded-Host` does not select the application audience.

Next trailing-slash redirects are disabled so `/api/admin/` cannot redirect before the host policy runs. No Server Actions are added. Future actions/route handlers must retain server-side session and origin checks; Proxy is not a substitute for authorization.

Login and logout continue using relative admin API URLs and relative CRM navigation. Creation and expiry cookies are HttpOnly, Secure in production, SameSite=Lax, Path=/ and host-only, without Domain. A CRM cookie therefore cannot be sent to the sibling public hostname. Staff must sign in again on CRM: an old cookie stored on the public hostname cannot migrate across hosts, and public-host requests no longer recognize or issue admin sessions. Do not add `.sslip.io` as a cookie domain.

Admin mutations, including login/logout, require the exact configured CRM Origin **and** CRM Host. Public/foreign/missing/malformed Origins fail. The existing login limit (10 attempts per 15 minutes) is retained. Public mutation guards require the exact public Origin/Host. Trusted Nginx must overwrite Host/forwarding headers and application port 3000 must stay loopback-only; a client who can connect directly to an exposed upstream can spoof Host.

## Local verification

Run quality gates with generated test values for build/runtime configuration. Do not use a live database.

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
node deploy/verify-bundles.mjs
node --test deploy/customer-crm.test.mjs deploy/image-verification.test.mjs deploy/repository-verification.test.mjs
node deploy/verify-customer-crm.mjs
```

The HTTP verifier uses an ephemeral loopback port, an in-memory Prisma fixture, generated password/session/catalog test values and an unreachable loopback inventory endpoint. It exercises production rendering, actual login/logout routes, authenticated CRM pages, cookie headers, blocked APIs, preserved redirects and Next runtime assets. It does not migrate/query a real PostgreSQL database or read an existing `.env`. Build with the public staging origin above; CI can select its synthetic public origin through `NEXT_PUBLIC_SITE_URL`. Fixture results establish application behavior, not real-database connectivity or TLS issuance. The fixture preload exists only in a temporary directory and is removed when the server exits.

Customer CI covers this branch and runs the HTTP verifier after its production build. Docker image health verification and the Compose healthcheck connect to loopback while sending the configured public Host. The separate host health script requires `NEXT_PUBLIC_SITE_URL` in its process environment. The script does not load an environment file or disclose response bodies.

## Nginx review templates

Use `deploy/nginx/customer-crm.conf.template` with `customer-proxy.inc` and `customer-admin-redirect.inc`. Both HTTPS hosts proxy permitted traffic to **the same** `127.0.0.1:3000`. Public admin APIs are rejected at Nginx as well as in Next. CRM defaults to 404 outside its explicit route/asset allowlist. Inventory vhosts and the existing catalog allowlist are untouched.

The templates assume standard Certbot certificate paths with these certificate names. If the actual certificate name/path differs, adjust the reviewed copy before installation. The required new TLS name is:

`maqamstay-crm.169-58-95-12.sslip.io`

The public TLS name remains `maqamstay-staging.169-58-95-12.sslip.io`. Verify both DNS resolutions and certificate SANs/expiry before rollout. This task provisions neither certificates nor DNS. A default Nginx vhost should reject unrecognized server names; keep the existing default-host policy under separate review. Root at CRM permits only GET/HEAD. App Router RSC requests under admin paths and runtime assets use the same upstream.

## Future VPS rollout (operator-only; not executed here)

1. Obtain explicit deployment approval and require a passing production dependency audit for the approved commit. The Next security patch below resolves the previously reported production-audit blocker. Record the currently running Customer image digest, runtime-file version and current Customer-only Nginx blocks. Inspect the actual Compose/service/config paths and ensure the checkout is clean. Leave all Inventory virtual hosts, containers and network configuration untouched.
2. Fetch `origin/feature/separate-customer-crm` and verify the approved final commit before checking it out. Use the reviewed Customer release/runtime images built from that commit; no GHCR publication is part of this task. For a local image build, from the Customer checkout:

   ```bash
   CUSTOMER_COMMIT=$(git rev-parse HEAD)
   docker build -f deploy/Dockerfile --target runtime \
     --build-arg NEXT_PUBLIC_SITE_URL=https://maqamstay-staging.169-58-95-12.sslip.io \
     --build-arg NEXT_PUBLIC_WHATSAPP_NUMBER="$APPROVED_PUBLIC_SUPPORT_NUMBER" \
     -t "local/maqamstay-customer:$CUSTOMER_COMMIT" .
   docker build -f deploy/Dockerfile --target release \
     -t "local/maqamstay-customer-release:$CUSTOMER_COMMIT" .
   ```

   First complete isolated image verification if still outstanding. No runtime secrets are Docker build arguments. No migration or admin bootstrap is needed for hostname separation.

3. Update only the protected Customer runtime file with the two exact origins above, retaining its existing PostgreSQL/session/catalog secrets and HTTPS catalog origin. Keep that file outside Git and restrictive to the deployment operator. Record the image IDs/digests and use the site's established Compose image-selection mechanism. Do not overwrite a live secret file with the example template.
4. After a separate certificate authorization, provision/verify the CRM certificate. `certbot certonly --webroot -w "$EXISTING_ACME_WEBROOT" -d maqamstay-crm.169-58-95-12.sslip.io --cert-name maqamstay-crm.169-58-95-12.sslip.io` is applicable **only if** the existing ACME webroot/challenge route is verified. Otherwise use the host's established certificate method; do not run standalone Certbot against occupied port 80 or guess a webroot. No certificate changes are executed during repository work.
5. Install reviewed include files under `/etc/nginx/maqamstay/`, and replace/add only the Customer public/CRM virtual hosts. Remove duplicate Customer `server_name` definitions from the active configuration. Preserve every Inventory/default vhost and existing ACME challenge handling. Do not install a second conflicting public vhost alongside the old one.
6. Validate before switching traffic with `nginx -t`. Using the existing deployment's Compose files and runtime-file selectors, recreate **only** the `customer` service. No release job, PostgreSQL restart or schema mutation is part of this rollout. Set the following non-secret path/project selectors to the verified existing deployment, then run:

   ```bash
   : "${STAGING_COMPOSE_PROJECT:?Use the existing Compose project name}"
   : "${STAGING_COMPOSE_ENV_FILE:?Use the existing protected image/runtime selectors file}"
   : "${CUSTOMER_CHECKOUT:?Use the reviewed Customer checkout}"
   : "${INVENTORY_CHECKOUT:?Use the existing Inventory checkout without changing it}"
   docker compose --project-name "$STAGING_COMPOSE_PROJECT" \
     --env-file "$STAGING_COMPOSE_ENV_FILE" \
     -f "$CUSTOMER_CHECKOUT/deploy/docker-compose.staging.yml" \
     -f "$INVENTORY_CHECKOUT/deploy/docker-compose.staging.yml" \
     up -d --no-deps customer
   curl -f -H 'Host: maqamstay-staging.169-58-95-12.sslip.io' http://127.0.0.1:3000/
   ```

   Do not invent a different Compose project name: that could create a second deployment or different database volumes. If the running stack uses different Compose files/overrides, retain those exact files rather than switching it to this example.

7. Only after the upstream and Nginx validation succeed, perform the approved Nginx reload. Check both HTTPS hosts externally: public home/hotels/request; public admin redirects with query retention; public admin APIs return 404 without Location; CRM login/assets work; CRM public request APIs return 404. Sign in on CRM with an authorized test account and check requests/bookings/commissions, logout and actual cookie attributes. Validate public request submission, quote creation/sharing/interest, bookings/commissions/reviews and HTTPS catalog reads against authorized staging fixtures. Never use customer production data for acceptance tests.

The application shares one process, so its image replacement briefly affects both Customer and CRM. Use the site's established drain/maintenance procedure if continuous availability is required. Do not claim zero-downtime deployment from this template alone. Nginx runtime syntax/TLS and real-database acceptance still require authorized infrastructure verification.

## Rollback

Retain the previous image/runtime/config versions before rollout. If validation fails, restore the previous compatible Customer image and Customer-only Nginx blocks, run `nginx -t`, and reload only after validation. PostgreSQL schema/data and Inventory services are unchanged: no database restore or credential rotation is warranted.

The previous image may allow admin access on the public host. During rollback retain the public admin API block **and** public admin-page redirect (or block those pages if CRM is closed). Restrict staff access/keep CRM closed until a known secure version is available; do not silently reopen public admin pages/APIs. Returning to a prior image may require its original public build origin/config. Existing CRM cookies remain host-only; never widen their Domain as a rollback measure. Users may need to sign in again.

## Limits of the checks

Unit tests validate persisted-session decisions through a mocked database, and HTTP fixtures validate the built application without a database server. Existing request/quote/booking/commission/review/catalog regression suites run unchanged. Real PostgreSQL integration, Nginx `-t`, actual HTTPS cookie behavior in a browser and Docker runtime checks remain separate acceptance steps when the required tools/environment are available.

## Original hostname-separation acceptance (8 October 2026, before security patch)

| Check                                     | Result                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Formatting / lint / strict TypeScript     | PASS                                                                                  |
| Vitest                                    | 140 tests across 19 files PASS                                                        |
| Node deployment regressions               | 17 tests PASS                                                                         |
| Production Next HTTP fixtures             | 38 checks PASS, including authenticated CRM pages and cookie headers                  |
| Browser bundle scan                       | 22 assets PASS                                                                        |
| Clean-source `npm ci` and `npm run build` | PASS; no local `.env`, dependencies, build output or nested Inventory checkout copied |
| Local verification toolchain              | Node 24.12.0 / npm 11.6.2; pinned image toolchain remains unchanged                   |
| Docker / native Nginx execution           | Unavailable locally; image/container and `nginx -t` checks remain pending             |
| Production dependency audit               | FAIL: existing Next 16.3.6 is reported as one high-severity vulnerable package        |

No dependency versions or lockfile were changed by hostname separation. The full clean-install audit reports six high-severity packages, including existing development tooling. The unchanged CI production-audit step will fail until the reported Next advisories are addressed in a reviewed dependency patch; tests/security gates have not been bypassed. The high-severity [Next image-optimizer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4) requires configured remote image patterns, which this application does not have, but that does not resolve the package audit or the other reported Next advisories. Treat the dependency patch as a pre-deployment prerequisite.

All fixture work used generated values and unreachable loopback dependency endpoints. The Inventory repository, original evidence, VPS, Atlas, storage, DNS and certificates were untouched. No images were published and no database mutations/migrations ran.

## Next.js security patch verification (8 October 2026)

The original production audit exited 1 and reported Next 16.3.6 against `GHSA-cjq9-62q9-8jv4` and related Next advisories. npm's advisory metadata lists the affected range as `>=16.0.0 <16.3.8`. Next 16.3.8 is the smallest published patch outside that range; the automatically suggested 16.4.0 minor upgrade was unnecessary.

Only `next` and the matching `eslint-config-next` pins change from 16.3.6 to 16.3.8. npm regenerated the lockfile through `npm install --package-lock-only --ignore-scripts` in a clean source directory with no existing dependencies. The 12 version changes are confined to Next, its environment/SWC packages and its ESLint configuration/plugin. Unrelated lock entries remain identical, with no packages added/removed. React/React DOM remain 19.2.8 and Prisma/client remain 6.19.3. The patch retains Node `>=20.9.0` and React `^19.0.0` compatibility.

Resolution, clean installation and every check below used the repository-approved Node 24.21.0 / npm 11.19.0, matching the pinned Docker toolchain. A portable official Windows Node archive was verified against the official SHA-256 manifest; global Node/npm installations were unchanged. Local Customer dependencies were also refreshed with this toolchain. The clean build context excluded local `.env` files, dependencies, build output and the nested Inventory repository. Tests/build/HTTP checks used generated configuration, unreachable loopback dependency endpoints and existing in-memory/mock database fixtures.

| Check                                 | Result                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| Clean `npm ci`                        | PASS                                                                  |
| `npm run format:check`                | PASS                                                                  |
| `npm run lint`                        | PASS                                                                  |
| `npm run typecheck`                   | PASS                                                                  |
| `npm test`                            | 140 tests across 19 files PASS                                        |
| `npm run build`                       | PASS, Next 16.3.8                                                     |
| `npm audit --omit=dev`                | PASS, exit 0, zero vulnerabilities                                    |
| Deployment regressions                | 17 tests PASS                                                         |
| Production Customer/CRM HTTP fixtures | 38 checks PASS                                                        |
| Browser bundle/secret scan            | 22 assets PASS                                                        |
| Customer runtime/release containers   | PENDING: Docker CLI/Desktop unavailable locally; no VPS fallback used |

Public admin redirects retain path/query, public admin APIs return 404 without redirects, authenticated CRM pages render, and the real admin guard accepts CRM Origin with a fixture session while rejecting public/arbitrary Origins. Login/logout cookie headers remain host-only, Secure, HttpOnly and SameSite=Lax. Existing request, quote, booking, commission, review and inventory catalog regression suites pass. `CUSTOMER_CRM_ORIGIN`, `INVENTORY_CATALOG_API_KEY` and `DATABASE_URL` remain server-only and absent from browser bundles. No application source, authentication policy, Nginx configuration, CI security gate, Prisma schema or migration changes accompany the patch. Prisma postinstall only generates the client; it runs no migrations.

The full audit still exits 1 for five existing development-only packages in the Next ESLint/fast-glob/micromatch/braces chain. These are outside the requested production security patch; no unrelated upgrade or audit suppression was applied. Production audit is clean. Docker runtime verification, actual Nginx/TLS and authorized real-database staging acceptance remain pending infrastructure checks.
