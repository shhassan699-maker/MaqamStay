# Dedicated staging deployment user/key setup — operator guide only

**None of these commands was executed during repository implementation.** Execute later from an authorized administrative console after review. This guide prepares access and configuration; it does not deploy applications. Do not start a workflow or push `staging` until this preparation and separate deployment authorization are complete.

1. Confirm the actual VPS is the intended staging host, x86-64, with an existing healthy MaqamStay stack, valid HTTPS hosts, working Docker Compose v2 and Nginx. Confirm both owner-supplied projects and their distinct selector paths against the exact version-2 configuration below; do not combine the projects. Confirm PostgreSQL volume/network names and the existing media mount. Do not guess a new project name. Keep existing unrelated container IDs and volumes as comparison evidence. Confirm at least 12 GiB free disk and 512 MiB available RAM. Confirm `/usr/bin/docker`, `/usr/bin/node` (approved Node 24), `/usr/bin/flock`, `/usr/bin/timeout`, `/usr/bin/df`, `/usr/bin/curl`, `/usr/bin/sudo` and `/usr/sbin/nginx` exist. Provision missing host tools separately through the host's approved package process; do not build images on the VPS.

2. On a trusted operator workstation **outside the repositories**, generate a dedicated key later. This is a future example, not a command run here:

   ```bash
   umask 077
   ssh-keygen -t ed25519 -C maqamstay-staging-actions -f "$HOME/.ssh/maqamstay-staging-actions" -N ''
   ```

   Store the private key in the organization's secret manager and then as GitHub `STAGING_VPS_SSH_KEY` in both repositories' `staging` Environment. Never paste it into Git, terminal logs, issues or this documentation. Only its `.pub` file goes to the VPS. Rotate/revoke this dedicated key independently of operator SSH keys.

3. From the authorized VPS administrator console, create the locked account with a shell required for the forced command. Do not put it in `docker`, `sudo`, `adm` or another privileged group:

   ```bash
   sudo useradd --create-home --shell /bin/bash maqamstay-deploy
   sudo passwd --lock maqamstay-deploy
   sudo install -d -o root -g root -m 0755 /home/maqamstay-deploy/.ssh
   ```

   If the account already exists, inspect/review it instead of rerunning `useradd`. Ensure the home is root-owned and not writable by the deployment user so the user cannot replace `.ssh`:

   ```bash
   sudo chown root:root /home/maqamstay-deploy
   sudo chmod 0755 /home/maqamstay-deploy
   ```

   Keep any `.bashrc`, `.profile`, `.bash_profile`, `.bash_logout` and `.ssh/environment` files root-owned and not writable by this account. For a newly created account, secure the standard startup files from `/etc/skel`:

   ```bash
   sudo chown root:root /home/maqamstay-deploy/.bashrc /home/maqamstay-deploy/.profile /home/maqamstay-deploy/.bash_logout
   sudo chmod 0644 /home/maqamstay-deploy/.bashrc /home/maqamstay-deploy/.profile /home/maqamstay-deploy/.bash_logout
   ```

   If that distribution supplies different startup files, inspect and secure those actual files instead. Confirm key authentication is supported for the password-locked account under the host's existing PAM/OpenSSH policy; do not broadly enable password authentication.

4. Transfer reviewed non-secret files via the administrator's established process to an administrator-owned staging directory. Customer and Inventory shared `deploy/cicd` files must match byte-for-byte. Install the complete reviewed version-2 host engine: `configuration.mjs`, `deployment.mjs`, `host.mjs`, `entry.sh`, `ssh-dispatch.sh`. Old engine copies/config schemas are incompatible and must not be mixed. Record their source commits/checksums. Install only these files, not a user-writable checkout:

   ```bash
   # Set this to the verified administrator-owned transfer directory.
   : "${REVIEWED_CICD_SOURCE:?Absolute reviewed source directory required}"
   sudo install -d -o root -g root -m 0755 /usr/local/lib/maqamstay-cicd
   sudo install -o root -g root -m 0644 "$REVIEWED_CICD_SOURCE/configuration.mjs" /usr/local/lib/maqamstay-cicd/configuration.mjs
   sudo install -o root -g root -m 0644 "$REVIEWED_CICD_SOURCE/deployment.mjs" /usr/local/lib/maqamstay-cicd/deployment.mjs
   sudo install -o root -g root -m 0644 "$REVIEWED_CICD_SOURCE/host.mjs" /usr/local/lib/maqamstay-cicd/host.mjs
   sudo install -o root -g root -m 0755 "$REVIEWED_CICD_SOURCE/entry.sh" /usr/local/lib/maqamstay-cicd/entry.sh
   sudo install -o root -g root -m 0755 "$REVIEWED_CICD_SOURCE/ssh-dispatch.sh" /usr/local/lib/maqamstay-cicd/ssh-dispatch.sh
   ```

   Keep all ancestor directories root-owned, not group/world-writable and not symlinks. Future host-script changes require this reviewed installation step again. CI cannot update privileged code or Compose files remotely.

5. Install the dedicated **public** key using a root-owned `authorized_keys`. Replace `PASTE_DEDICATED_PUBLIC_KEY` below with the complete `ssh-ed25519 ...` public line only. Create/review the file through `sudoedit`; do not overwrite unrelated authorized keys:

   ```bash
   sudoedit /home/maqamstay-deploy/.ssh/authorized_keys
   ```

   Add exactly this one line:

   ```text
   restrict,command="/usr/local/lib/maqamstay-cicd/ssh-dispatch.sh" PASTE_DEDICATED_PUBLIC_KEY
   ```

   Then secure it:

   ```bash
   sudo chown root:root /home/maqamstay-deploy/.ssh/authorized_keys
   sudo chmod 0644 /home/maqamstay-deploy/.ssh/authorized_keys
   ```

   Public keys are not secrets. Root ownership prevents the deployment account from replacing the forced command; readable mode permits sshd to authorize it. `restrict` disables PTY, agent/X11/port forwarding and user rc execution. Do not install the key for root or another interactive administrator.

6. Add a narrow sudo rule using `visudo`; no general shell/Docker/sudo access:

   ```bash
   sudo visudo -f /etc/sudoers.d/maqamstay-staging-deploy
   ```

   File contents:

   ```sudoers
   Defaults:maqamstay-deploy env_reset
   Defaults:maqamstay-deploy !setenv
   Defaults:maqamstay-deploy secure_path=/usr/sbin:/usr/bin:/sbin:/bin
   maqamstay-deploy ALL=(root) NOPASSWD: /usr/local/lib/maqamstay-cicd/entry.sh
   ```

   A sudo command listed without arguments permits arguments to that **single** script; `entry.sh` validates exactly `validate <customer|inventory> <sha>` or `deploy <customer|inventory> <sha> <digest-1> <digest-2>` and dispatches only approved image namespaces/services. It cannot execute arbitrary strings. Never add `SETENV`, shell, unrestricted Node, Docker or wildcard script paths. Confirm the host has no global sudo `env_keep` preserving `BASH_ENV`, `ENV`, `NODE_OPTIONS` or `NODE_PATH` for this user. Validate and secure:

   ```bash
   sudo chmod 0440 /etc/sudoers.d/maqamstay-staging-deploy
   sudo visudo -cf /etc/sudoers.d/maqamstay-staging-deploy
   ```

7. Prepare the protected state/config directories, leaving actual runtime files and media contents intact:

   ```bash
   sudo install -d -o root -g root -m 0700 /etc/maqamstay-staging
   sudo install -d -o root -g root -m 0700 /var/lib/maqamstay-cicd
   sudo touch /var/lib/maqamstay-cicd/deploy.lock
   sudo chown root:root /var/lib/maqamstay-cicd/deploy.lock
   sudo chmod 0600 /var/lib/maqamstay-cicd/deploy.lock
   ```

   Create the lock file only during initial setup; never remove/replace an existing or active lock file. Its root-only parent prevents unprivileged replacement, and kernel locks are released after exit/reboot. Review permissions of existing files before adjusting them. Customer and Inventory runtime secrets stay at `/etc/maqamstay-staging/customer.env` and `/etc/maqamstay-staging/inventory.env`, root-owned `0600`. Keep PostgreSQL/runtime identities unchanged. Customer uses the existing `/etc/maqamstay-staging/customer-release.env` and `/etc/maqamstay-staging/postgres.env`; Inventory's runtime/index role uses only `/etc/maqamstay-staging/inventory.env`. Review permissions/roles through the host's secret manager, never GitHub; do not create extra application files or change database identities in this setup. Do not overwrite existing env files with examples. No environment values should be printed during preparation.

8. Review/install the existing ordered Compose files as root-owned non-symlink files under root-owned directories; use their **existing actual paths**. Preserve all live volume, network, port and PostgreSQL configuration. The reviewed Customer source removes the old hardcoded `INVENTORY_API_URL` override, so the existing approved catalog origin must already be present in `customer.env`. Inventory's `/opt/maqamstay-staging/data/media` bind must already exist and be writable to the container's Node UID; do not create empty replacement storage or recursively change its contents/ownership in this guide. Release services must be inert by default and isolated to their database/application network. Verify their existing `APP_ENV=staging`/`CONFIRM_ENVIRONMENT=staging` and environment selectors.

9. Preserve two existing selector files: `/opt/maqamstay-staging/deployment/customer-images.env` and `/opt/maqamstay-staging/deployment/inventory-images.env`. Never overwrite a live file with an example, combine them or hard-link them. Customer permits only `CUSTOMER_IMAGE`, `CUSTOMER_RELEASE_IMAGE` and matching optional `CUSTOMER_ENV_FILE`, `CUSTOMER_RELEASE_ENV_FILE`, `POSTGRES_ENV_FILE` paths. Inventory permits only `INVENTORY_API_IMAGE`, `INVENTORY_ADMIN_IMAGE` and matching optional `INVENTORY_API_ENV_FILE`, `INVENTORY_RELEASE_ENV_FILE` paths. Current image values must be the approved GHCR digests or retained immutable Docker image IDs. Keep those images locally for rollback. Root-own both files with mode `0600`. Repository-local `deploy/images.env.example` now documents only that repository's selectors. The protected config injects selected env paths into Compose without exporting their values.

10. Through a separately approved operator step, install `/etc/maqamstay-staging/cicd.json` as root-owned `0600` with the **exact** non-secret JSON in [staging-cicd.md](staging-cicd.md#protected-configuration-and-non-mutating-validation), also available in `deploy/cicd/cicd.example.json`. Customer project is `maqamstay-customer-staging`, ordered files `/opt/maqamstay-staging/customer/deploy/docker-compose.staging.yml` and `/opt/maqamstay-staging/deployment/phase3b-customer.override.yml`; Inventory project is `maqamstay-staging`, with only `/opt/maqamstay-staging/inventory/deploy/docker-compose.staging.yml`. Their separate selector paths are given in step 9. Do not substitute another project/path. Both definitions share the existing lock/journal directory. The strict schema contains repository identities, runtime services, protected env paths, release commands, health origins/profiles and Inventory media mount; it contains no credentials. Unknown fields and cross-routing are rejected.

11. Prepare GHCR pull access. Prefer approved public package visibility when suitable; otherwise provision a machine identity with **read:packages only** on the VPS and grant access to all four packages. Authenticate via `docker login ghcr.io --password-stdin` as the administrator without echoing the token, then protect `/root/.docker/config.json` and any credential-helper configuration. Do not add this registry token to application env files or the deployment SSH user, and never give the deployment user Docker-group membership. Keep previous digests/images available for rollback. No pruning is automated.

12. Obtain the VPS SSH host public-key fingerprint from an independent trusted channel such as the provider console. For example, at the console inspect `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`. On the trusted workstation, collect the matching known_hosts line with `ssh-keyscan -t ed25519 169.58.95.12`, compare its fingerprint to the trusted console result, then set `STAGING_VPS_KNOWN_HOSTS` in each Environment. **A keyscan alone is not verification.** The line must match the exact `STAGING_VPS_HOST`. If using a DNS name instead, verify/store that name's entry. Never use `StrictHostKeyChecking=no` or `accept-new` in CI.

13. Create Environment `staging` in both repositories, restrict allowed deployment branches to exactly `staging`, and set `STAGING_VPS_HOST`, `STAGING_VPS_USER`, `STAGING_VPS_SSH_KEY`, `STAGING_VPS_KNOWN_HOSTS`. Set Customer repository variable `STAGING_PUBLIC_WHATSAPP_NUMBER` to the approved public number. Enable GitHub-hosted Actions/billing and GHCR package permissions. Configure the branch protections described in `staging-cicd.md`. Required environment reviewers introduce a deliberate manual gate; leave them unset if fully automatic post-CI deployment is required. Application database/session/catalog/storage secrets remain VPS-only.

14. Before activation, an operator can verify rejection using `ssh -T ... 'id'` with the dedicated key and strict independently pinned known_hosts. It must exit 64 and expose no shell. Confirm PTY/forwarding and unrelated sudo commands are denied. Then, only during that separately authorized setup, use the new safe protocol to validate each definition. Replace the hashes below with the approved feature commit hashes; no deployment digests or application credentials are required. These are future examples, **not commands executed in this repository task**:

    ```bash
    ssh -F /dev/null -T -i "$DEPLOYMENT_KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$VERIFIED_KNOWN_HOSTS_FILE" maqamstay-deploy@169.58.95.12 'validate customer FULL_40_CHARACTER_CUSTOMER_SHA'
    ssh -F /dev/null -T -i "$DEPLOYMENT_KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$VERIFIED_KNOWN_HOSTS_FILE" maqamstay-deploy@169.58.95.12 'validate inventory FULL_40_CHARACTER_INVENTORY_SHA'
    ```

    Validation uses the existing shared lock, verifies strict JSON routing and selected file ownership/modes, runs Compose read-only configuration checks, checks current Docker health, resource thresholds and selected PostgreSQL or media/network identity, then prints sanitized JSON. It never pulls, edits selectors/config, journals, executes container jobs, probes HTTP, migrates/provisions indexes, recreates containers, invokes/reloads Nginx or writes databases. A missing lock fails rather than creating it. Do not send a `deploy ...` command during setup. Validation cannot prove public TLS/HTTP acceptance; those remain required during a later authorized deployment. Inventory then requires private health 200, public Admin 200, credential-free catalog 401, protected GET paths 404 and writes 405. Do not expose public health or relax the catalog allowlist. Review installed checksums and independently run `nginx -t` only if separately approved; no Nginx configuration write or reload is part of this setup.

15. Only after a separate deployment authorization, complete the initial image baseline and health acceptance, then create/merge/push the reviewed `staging` branches normally. The pipeline will run CI, publication, then digest deployment. Review artifacts/journals after the first authorized deployment. This repository task did not perform this step.

For future rollback recovery after power loss, take the same lock, inspect the protected journal's `previous` digests and any coordinator `.pending` file, restore only the affected image selectors, and use the established Compose flags with `up -d --no-deps --no-build --pull never --force-recreate` for the affected service only. Verify the documented health checks. Database migration failure/compatibility requires explicit manual review; never reset migrations, downgrade/delete data or restore over live databases automatically.

## Future Customer selector baseline normalization

**No command below was run during this repository task.** This is a future, separately authorized administrator-console procedure, not a deployment action or a forced SSH operation. Normalization necessarily changes selector configuration/permissions; it is non-mutating with respect to running containers, application env files, databases, volumes, networks and media. Validation itself remains fully read-only and will continue to reject the old Customer 0644/mutable-tag baseline until an administrator performs this step.

1. Install the reviewed matching host engine and protected JSON first, including `requiredProfiles: ["release"]` in both deployment definitions. Keep the existing lock. The exact JSON is in `deploy/cicd/cicd.example.json`; the two-field delta and quiet profile render commands are in [staging-cicd.md](staging-cicd.md#required-compose-release-profile-and-selector-baseline). Do not modify the actual Compose definitions or start release services to make them visible.
2. Inspect selector/ancestor ownership and metadata without printing contents. Confirm a root-owned non-symlink Customer selector, no writable/symlink ancestor, one hard link, and the existing mode. If ownership/ancestry is unsafe, stop for administrator review rather than accepting it. Mode 0644 can be corrected only by this administrator step, never by validation:

   ```bash
   sudo stat -c '%U:%G %a links=%h' /opt/maqamstay-staging/deployment/customer-images.env
   ```

3. Confirm through the approved image inventory that the current `CUSTOMER_RELEASE_IMAGE` selector names the already-installed, reviewed Customer **release** image. There is normally no running release container to inspect. If that image is absent, ambiguous or unreviewed, stop; do not pull/build/run it as part of normalization. The example resolves that existing reference through local `docker image inspect` only.
4. Transfer the reviewed `normalize-customer-baseline.example.sh` with the engine files to the administrator-owned source directory. Install and execute it only with the separately authorized administrator account, never `maqamstay-deploy`. The dedicated deployment account's sudo rule remains restricted to `entry.sh`; no new sudo or SSH operation is permitted:

   ```bash
   : "${REVIEWED_CICD_SOURCE:?Absolute reviewed administrator-owned source directory required}"
   sudo install -o root -g root -m 0700 "$REVIEWED_CICD_SOURCE/normalize-customer-baseline.example.sh" /usr/local/lib/maqamstay-cicd/normalize-customer-baseline.example.sh
   sudo /bin/bash /usr/local/lib/maqamstay-cicd/normalize-customer-baseline.example.sh
   sudo stat -c '%U:%G %a links=%h' /opt/maqamstay-staging/deployment/customer-images.env
   ```

   The complete copyable procedure is the repository file `deploy/cicd/normalize-customer-baseline.example.sh`. It takes the same existing exclusive lock, checks protected configuration/ancestry, requires exactly one healthy running Customer with the correct project/service labels, obtains its actual `.Image` full SHA256 ID (not the old `.Config.Image` tag), and resolves the installed release image's full local ID. It verifies both images are retained locally. It substitutes only `CUSTOMER_IMAGE` and `CUSTOMER_RELEASE_IMAGE`, validates the candidate using the exact unchanged production parser before any writes, detects concurrent selector changes, creates a root-only timestamped `customer-images.env.before-immutable.*` backup, establishes root:root/0600 and atomically writes the selector. It then checks the same running Customer container/image/health/mount/network identity. Outputs contain fixed success/failure labels only; no selector contents, protected env values or Docker stderr are printed. Inventory selectors and PostgreSQL are never opened/inspected/changed.

   There are no `pull`, Compose, release job, migration/index, recreation, prune, Nginx or database commands. Do not run `up` after editing selectors: the running container already uses the recorded image ID. A missing installed image, invalid selector key, hard link or pre-existing `.pending` file fails closed. On failure review the protected backup/pending state manually; never delete unknown checkpoints or trigger deployment as a workaround.

5. Later, with reviewed engine/configuration and the pinned deployment key/known_hosts, use the existing `validate customer <approved-full-sha>` and `validate inventory <approved-full-sha>` requests from step 14. Customer now passes the unchanged immutable selector and root-only permission gates; profile-enabled rendering sees its release job. Validation will still fail on any real health/resource/topology issue and never repairs it. No staging branch creation or deployment is part of this procedure.
