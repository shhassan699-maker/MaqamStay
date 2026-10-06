# Phase 1 verification — 6 October 2026

Work was performed only in the local Windows repositories and their GitHub review branches. No VPS connection or infrastructure changes were made. No migration, index/profile mutation, bootstrap or publication job ran.

| Gate                                                     | Local result                         |
| -------------------------------------------------------- | ------------------------------------ |
| Customer lint                                            | PASS                                 |
| Customer strict TypeScript                               | PASS                                 |
| Customer formatting                                      | PASS                                 |
| Customer tests                                           | 75 PASS across 17 files              |
| Customer production build                                | PASS                                 |
| Customer public bundle scan                              | 22 assets PASS                       |
| Inventory lint/strict TypeScript/formatting              | PASS                                 |
| Inventory tests                                          | 131 PASS across 4 files              |
| Inventory API and Admin production builds                | PASS                                 |
| Inventory/customer browser tests                         | 9 PASS                               |
| Admin public bundle scan                                 | 17 assets PASS                       |
| Staged source credential-pattern/hygiene checks          | PASS                                 |
| Linux image builds/startup/non-root/history/config scans | BLOCKED; no Docker available locally |
| GHCR publication                                         | NOT RUN                              |

GitHub rejected [the customer CI run](https://github.com/shhassan699-maker/MaqamStay/actions/runs/37450264576) before starting any steps: "The job was not started because your account is locked due to a billing issue." This is an account prerequisite, not a passing CI run. Both source branches retain automatic isolated image verification for when hosted runners become available.

Image non-root/read-only/tmp/cache behavior, combined Compose validation and executable Nginx allowlist checks are implemented but remain unverified by execution. Source review confirms USER node, digest-pinned bases, loopback application mappings, no PostgreSQL host mapping, network separation and the specified HTTPS customer/private Admin origins. Restore tests and real TLS/provider recovery acceptance are intentionally outside Phase 1.

The browser suite emitted the existing Next destination-stream-closed message during navigation; all assertions passed. No change to customer or Inventory business behavior was made to suppress it.

Next: restore GitHub Actions availability or provide an isolated local Docker engine, run both CI workflows to completion, then review branches. Do not publish or deploy until the container verification succeeds. Later infrastructure work requires the separate read-only VPS audit and staging resource/secret preparation.

## Additional isolated checks

Fresh npm ci and production builds passed in both temporary source checkouts without real .env files. The isolated Admin manifest contains exactly http://inventory-api:4000/api/:path*. All four coordinated workflow files pass checksum-verified actionlint v1.7.12. Compiling/checking the release bootstrap syntax passed without executing the bootstrap.

Fresh customer installation initially reported six high findings. The compatible source-map-js 1.2.2 lockfile patch addresses the [runtime advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q); production audit now reports zero. Five development-tool dependency findings remain through the [unpatched braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). No framework downgrade or broad audit fix was performed. Release tooling compiles the existing bootstrap to JavaScript and prunes development dependencies; image execution must still verify the resulting contents. CI gates high production dependency findings. Inventory reports zero production vulnerabilities.

Direct inspection of the pinned Node 24.21.0 Linux base found no libssl3 or OS CA bundle. The customer Dockerfile supplies pinned Debian OpenSSL/libssl3/CA packages for Prisma's native engine. Image CI checks the Prisma engine version without running a database mutation.
