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
