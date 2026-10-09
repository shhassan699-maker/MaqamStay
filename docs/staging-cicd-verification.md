# Repository CI/CD verification — 9 October 2026

This report records the initial implementation and local verification snapshot, before the separately authorized feature-branch commits and pushes. At that snapshot, no VPS connection, deployment, GHCR publication, key generation/installation, remote GitHub change or staging branch creation occurred. The commits below are the approved starting commits, not the final CI/CD commits.

| Repository | Branch                          | Starting commit                            |
| ---------- | ------------------------------- | ------------------------------------------ |
| Customer   | `feature/separate-customer-crm` | `efd093b67050821580178a1504a71223a7f5d0b0` |
| Inventory  | `feature/staging-local-storage` | `8cb4fa2650f7da99ebdc97f8bf53382a66fc591e` |

The official Windows Node archive was verified against its official SHA256 manifest. Local checks use Node **24.21.0**, npm **11.19.0**, matching the pinned Docker toolchain. Sources were exported into ignored repository-local clean directories, excluding real `.env`, existing dependencies, `.next`, media and the nested Inventory checkout. Each clean install used the lockfile and synthetic build/test configuration. No real database credentials were supplied; integration/browser suites use their existing disposable loopback Mongo fixtures and temporary storage.

| Check                                         | Customer                   | Inventory                                                      |
| --------------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| Clean `npm ci`                                | PASS                       | PASS, including a fresh source export after the security patch |
| `npm audit --omit=dev`                        | PASS: zero vulnerabilities | PASS: zero vulnerabilities after Next patch                    |
| Formatting                                    | PASS                       | PASS                                                           |
| Lint                                          | PASS                       | PASS                                                           |
| Strict TypeScript                             | PASS                       | PASS                                                           |
| Unit/integration/security tests               | 140 PASS, 19 files         | 162 PASS, 5 files including local-storage regressions          |
| Production build                              | PASS, Next 16.3.8          | PASS: API and Admin, Next 16.3.8                               |
| Customer/CRM production HTTP fixture          | 38 checks PASS             | Customer fixture retained in the coordinated CI                |
| Browser bundle/secret scans                   | 22 assets PASS             | Admin 17 / Customer 22 assets PASS                             |
| Existing deployment regressions               | 17 PASS                    | 15 coordinated regressions PASS                                |
| Chromium publishing/responsive/security suite | Covered through Inventory  | 9 PASS                                                         |
| New CI/CD tests                               | 31 PASS                    | 31 PASS                                                        |
| YAML parsing and workflow security assertions | PASS                       | PASS                                                           |
| actionlint 1.7.12                             | PASS                       | PASS                                                           |
| shellcheck 0.11.0 and Bash syntax             | PASS                       | PASS                                                           |
| Repository source credential-pattern scan     | PASS                       | PASS                                                           |
| `git diff --check`                            | PASS                       | PASS                                                           |

New tests cover immutable SHA/digest input, preflight/pull/resource/release failures, partial recreation, Customer rollback, retained local-image rollback, independent API/Admin rollback, rollback health failure, atomic selector preservation/ambiguity/injection, workflow permissions/trigger isolation, command-injection rejection by shell parsers, reuse of published tags, fail-closed registry errors and publication/deployment evidence. They use simulated host adapters and fake registry executables; they do not invoke a VPS or Docker daemon. Atomic coordinator tests exercise real local temporary files. The source scanners report counts/failure labels only and never matching secret values.

Inventory's original clean install/audit reproduced the existing Next **16.3.6** production vulnerability. The necessary patch changes only `apps/admin/package.json` and Next-related lock entries to **16.3.8** (Next, `@next/env` and eight platform SWC packages). A fresh manifest-only lock regeneration used the approved toolchain without local dependencies or env files. No unrelated package version changed or package was added/removed. React/React DOM remain 19.2.8. Production audit is now zero. Full install audit output still reports existing development-only tool advisories (Inventory: two critical; Customer: five high); no full-audit suppression or broad upgrade was performed. The required production audit has no severity exemption.

Docker CLI/Desktop and native Nginx are unavailable on this workstation. Consequently Docker image builds/runtime verification, Docker-rendered Compose, actual host filesystem/permission/resource checks, native `nginx -t`, real SSH/GHCR integration, public TLS health and live migration/index/rollback acceptance are **NOT RUN locally**. Existing isolated Docker image checks remain mandatory CI gates before publication. No GitHub Actions run was triggered; runner/billing/Environment/package configuration must be checked during later authorized setup. Passing offline tests do not establish VPS readiness or container acceptance.

Inventory's browser fixture initially failed two Customer checks because the approved Customer commit requires distinct HTTPS public/CRM origins in production. `scripts/qa-server.mjs` and the Customer build configuration in Inventory CI now supply synthetic `https://localhost:3120` and `https://localhost:3121` origins. Browser requests continue through the loopback HTTP upstream with the matching public Host, modeling TLS ingress without provisioning TLS. The full nine-test suite passed after this fixture repair; production host/Origin/CSRF rules are unchanged.

At the initial snapshot, both trees contained modified and untracked implementation files; no new commit had been created. Local tool archives, clean validation checkouts and logs remain under ignored `.cicd-local/` and are excluded from Docker contexts. Generated IDE `.next` files were not edited.

The later finalization request authorizes committing and pushing only `feature/separate-customer-crm` and `feature/staging-local-storage`. Publication and deployment workflows accept only pushes to `staging`, so these feature-branch pushes cannot invoke them. Final commit IDs and matching remote branch heads are recorded in the finalization report after pushing. No VPS connection, deployment, staging branch creation, main merge, force push or secret addition is authorized by finalization.

Exact future setup is in [staging-vps-setup.md](staging-vps-setup.md); the complete behavior/security contract is in [staging-cicd.md](staging-cicd.md).

## Two-project configuration and validation-only protocol verification — 9 October 2026

This follow-up starts from approved Customer commit `59adda53c858c1497816f9b15e652c2531d56b82` on `feature/separate-customer-crm` and Inventory commit `85dbf25b45de96cffada84101c5eb77a83e3a890` on `feature/staging-local-storage`. It changes only CI/CD engine/configuration/test files, non-secret selector examples and the three staging CI/CD documents in each repository. Application business logic, dependency manifests/lockfiles, workflows, Compose definitions and Nginx configuration are unchanged. No VPS connection, deployment, application database/Atlas operation, GitHub secret addition or staging branch creation occurred.

The old single-project/selector model is replaced by strict version-2 `deployments.customer` and `deployments.inventory`. The exact non-secret configuration is in `deploy/cicd/cicd.example.json` and `staging-cicd.md`. Customer selects project `maqamstay-customer-staging`, its base Compose file followed by the phase3b override, its own selector file and only the `customer` runtime service. Inventory selects project `maqamstay-staging`, its single Compose file, its separate selector file and only API/Admin. Protected env paths are injected only into the selected Compose process. Inventory's rendered topology/container networks must stay on `maqamstay_inventory_app`; Customer PostgreSQL container/mount/network identity and Inventory media device/inode/mount are preserved.

The forced-command boundary now accepts exactly `validate customer <full-sha>` or `validate inventory <full-sha>` alongside the existing digest deployment protocol. Validation opens the existing root-only shared lock read-only, validates selected protected paths/permissions/configuration, runs read-only Compose configuration checks, checks disk/RAM and current Docker health, and emits sanitized evidence. It performs no pulls, selector/config writes, journals, migrations/index jobs, container execution/recreation, HTTP requests, Nginx operations or database writes. Missing locks fail rather than being created. Repository/service/project/path/image-selector injection, unknown/missing/ambiguous definitions and secret/unknown JSON fields fail closed.

All 18 shared files under `deploy/cicd`, including engine, configuration, tests and helper scripts, match byte-for-byte in both working trees. The complete CI/CD suite now has **85 passing tests in each repository**, including 37 new topology/protocol tests. New tests exercise the actual host adapter through injected filesystem/Docker simulators, not only the pure deployment state machine. They prove ordered Compose routing, separate selector/env access, Customer-only recreation, no Inventory PostgreSQL operations, shared disk/lock protections, non-mutating validation, cross-routing rejection and Customer/API/Admin rollback in the correct project. The positive SSH dispatcher test replaces only sudo with a local output stub; no real SSH/sudo/host operation runs. Inventory private/public health security remains covered by the same 17 health regression tests in both shared copies.

Sources were exported into ignored repository-local validation directories, excluding actual env files and the nested checkout. Both used clean lockfile `npm ci` with Node 24.21.0 / npm 11.19.0. Application integration/browser tests used synthetic configuration, disposable loopback Mongo fixtures and temporary storage. The initial Inventory Markdown formatting mismatch was corrected using Inventory's formatter; its complete formatting recheck passed.

| Check                                             | Customer                  | Inventory                                            |
| ------------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| Clean npm ci, formatting, application lint        | PASS                      | PASS                                                 |
| Explicit deploy/cicd lint with zero warnings      | PASS                      | PASS                                                 |
| Strict TypeScript                                 | PASS                      | PASS: API, tests and Admin                           |
| Application unit/integration/security tests       | 140 PASS in 19 files      | 162 PASS in 5 files, including staging local storage |
| Production builds                                 | PASS: Next 16.3.8         | PASS: API and Admin, Next 16.3.8                     |
| Production dependency audit                       | Zero vulnerabilities      | Zero vulnerabilities                                 |
| CI/CD tests and YAML/security assertions          | 85 PASS                   | 85 PASS                                              |
| Customer/CRM production HTTP acceptance fixture   | 38 checks PASS            | Retained in coordinated browser fixture              |
| Deployment/image/repository regressions           | 17 PASS                   | 15 coordinated regressions PASS                      |
| Chromium browser suite                            | Covered through Inventory | 9 PASS                                               |
| Browser bundle/secret scans                       | 22 assets PASS            | Admin 17 / Customer 22 assets PASS                   |
| Source credential-pattern scans                   | PASS                      | PASS                                                 |
| actionlint 1.7.12, shellcheck 0.11.0, Bash syntax | PASS                      | PASS                                                 |
| Shared-file byte identity and git diff --check    | PASS                      | PASS                                                 |

Docker CLI/Desktop and native Nginx are unavailable locally. Actual Docker image execution/rendering, VPS filesystem/resource checks, public HTTPS acceptance, real forced SSH authentication and live migration/index/deployment/rollback remain **NOT RUN**. Passing simulated tests does not establish VPS readiness. The new engine and exact protected JSON require a later reviewed operator installation, including the added `configuration.mjs`; repository feature-branch pushes cannot install them or trigger publication/deployment. Final new commit hashes and matching local/remote feature heads are reported after the authorized normal pushes. No main merge or force push is performed.
