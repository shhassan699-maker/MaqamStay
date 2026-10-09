# Dedicated staging deployment user/key setup — operator guide only

**None of these commands was executed during repository implementation.** Execute later from an authorized administrative console after review. This guide prepares access and configuration; it does not deploy applications. Do not start a workflow or push `staging` until this preparation and separate deployment authorization are complete.

1. Confirm the actual VPS is the intended staging host, x86-64, with an existing healthy MaqamStay stack, valid HTTPS hosts, working Docker Compose v2 and Nginx. Record its Compose project label, exact ordered Compose files/overrides and image coordinator path. Confirm PostgreSQL volume/network names and the existing media mount. Do not guess a new project name. Keep existing unrelated container IDs and volumes as comparison evidence. Confirm at least 12 GiB free disk and 512 MiB available RAM. Confirm `/usr/bin/docker`, `/usr/bin/node` (approved Node 24), `/usr/bin/flock`, `/usr/bin/timeout`, `/usr/bin/df`, `/usr/bin/curl`, `/usr/bin/sudo` and `/usr/sbin/nginx` exist. Provision missing host tools separately through the host's approved package process; do not build images on the VPS.

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

4. Transfer reviewed non-secret files via the administrator's established process to an administrator-owned staging directory. Customer and Inventory copies of `deploy/cicd/deployment.mjs`, `host.mjs`, `entry.sh`, `ssh-dispatch.sh` must match. Record their source commits/checksums. Install only these files, not a user-writable checkout:

   ```bash
   # Set this to the verified administrator-owned transfer directory.
   : "${REVIEWED_CICD_SOURCE:?Absolute reviewed source directory required}"
   sudo install -d -o root -g root -m 0755 /usr/local/lib/maqamstay-cicd
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

   A sudo command listed without arguments permits arguments to that **single** script; `entry.sh` validates exactly four restricted tokens and dispatches only approved image namespaces/services. It cannot execute arbitrary strings. Never add `SETENV`, shell, unrestricted Node, Docker or wildcard script paths. Confirm the host has no global sudo `env_keep` preserving `BASH_ENV`, `ENV`, `NODE_OPTIONS` or `NODE_PATH` for this user. Validate and secure:

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

   Create the lock file only during initial setup; never remove/replace an existing or active lock file. Its root-only parent prevents unprivileged replacement, and kernel locks are released after exit/reboot. Review permissions of existing files before adjusting them. Customer and Inventory runtime secrets stay at `/etc/maqamstay-staging/customer.env` and `/etc/maqamstay-staging/inventory.env`, root-owned `0600`. Keep PostgreSQL/runtime identities unchanged. Provision optional separate migration/index env files through the host's secret manager, never GitHub; these can also select the existing runtime files if those roles are approved for the release operation. Do not overwrite existing env files with examples. No environment values should be printed during preparation.

8. Review/install the existing ordered Compose files as root-owned non-symlink files under root-owned directories; use their **existing actual paths**. Preserve all live volume, network, port and PostgreSQL configuration. The reviewed Customer source removes the old hardcoded `INVENTORY_API_URL` override, so the existing approved catalog origin must already be present in `customer.env`. Inventory's `/opt/maqamstay-staging/data/media` bind must already exist and be writable to the container's Node UID; do not create empty replacement storage or recursively change its contents/ownership in this guide. Release services must be inert by default and isolated to their database/application network. Verify their existing `APP_ENV=staging`/`CONFIRM_ENVIRONMENT=staging` and environment selectors.

9. Configure `/etc/maqamstay-staging/images.env` (or the **existing** coordinator selected in the next step) with each current reviewed immutable image reference (GHCR digest or retained local Docker image ID) and the existing env selectors. Use `deploy/images.env.example` as a field reference, not a replacement file. Inventory can use the same selectors even though that example is maintained in Customer. Every image selector must occur exactly once with plain `KEY=value`, and no shell code. Required selector names:

   ```text
   CUSTOMER_IMAGE
   CUSTOMER_RELEASE_IMAGE
   INVENTORY_API_IMAGE
   INVENTORY_ADMIN_IMAGE
   CUSTOMER_ENV_FILE=/etc/maqamstay-staging/customer.env
   INVENTORY_API_ENV_FILE=/etc/maqamstay-staging/inventory.env
   CUSTOMER_RELEASE_ENV_FILE
   INVENTORY_RELEASE_ENV_FILE
   POSTGRES_ENV_FILE
   ```

   Selectors without shown values above require the actual digest/path. Secure the coordinator to root-owned `0600`. The current applications must be running and have a passing Docker healthcheck. Preflight records their actual GHCR repository digest, falling back to the retained immutable Docker image ID for locally built applications. Keep those images available; neither a mutable tag nor a rebuild is used for rollback. If the current baseline is unhealthy or missing, repair it through a separate authorized operator task before enabling automatic deployment.

10. Copy/review `deploy/cicd/cicd.example.json` through `sudoedit /etc/maqamstay-staging/cicd.json`. Set `project`, `composeFiles` (including existing overrides in order), `imagesFile`, `stateDirectory` to the actual inspected values. Use `minimumAvailableRamMiB` of at least 512. Secure root-owned `0600`. Do not use example names/paths to silently create a parallel stack. All selected config files and parents must pass the ownership rules. Use the established Compose command with these exact flags and `config --quiet` for validation; never print rendered secret configuration.

11. Prepare GHCR pull access. Prefer approved public package visibility when suitable; otherwise provision a machine identity with **read:packages only** on the VPS and grant access to all four packages. Authenticate via `docker login ghcr.io --password-stdin` as the administrator without echoing the token, then protect `/root/.docker/config.json` and any credential-helper configuration. Do not add this registry token to application env files or the deployment SSH user, and never give the deployment user Docker-group membership. Keep previous digests/images available for rollback. No pruning is automated.

12. Obtain the VPS SSH host public-key fingerprint from an independent trusted channel such as the provider console. For example, at the console inspect `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`. On the trusted workstation, collect the matching known_hosts line with `ssh-keyscan -t ed25519 169.58.95.12`, compare its fingerprint to the trusted console result, then set `STAGING_VPS_KNOWN_HOSTS` in each Environment. **A keyscan alone is not verification.** The line must match the exact `STAGING_VPS_HOST`. If using a DNS name instead, verify/store that name's entry. Never use `StrictHostKeyChecking=no` or `accept-new` in CI.

13. Create Environment `staging` in both repositories, restrict allowed deployment branches to exactly `staging`, and set `STAGING_VPS_HOST`, `STAGING_VPS_USER`, `STAGING_VPS_SSH_KEY`, `STAGING_VPS_KNOWN_HOSTS`. Set Customer repository variable `STAGING_PUBLIC_WHATSAPP_NUMBER` to the approved public number. Enable GitHub-hosted Actions/billing and GHCR package permissions. Configure the branch protections described in `staging-cicd.md`. Required environment reviewers introduce a deliberate manual gate; leave them unset if fully automatic post-CI deployment is required. Application database/session/catalog/storage secrets remain VPS-only.

14. Before activation, an operator can verify rejection without invoking a deployment: connect using the dedicated key with `ssh -T ... 'id'` and strict known_hosts. It must exit 64, create no application/container and expose no shell. Confirm port forwarding/PTY and unlisted sudo commands are denied. Review installed script checksums against the approved source. Do not send a valid `deploy ...` command during key setup. Validate Nginx with `nginx -t`; no reload is required for CI/CD installation. Do not change SSH daemon settings or reload it globally unless independently reviewed; the root-owned key restrictions supply the execution boundary.

15. Only after a separate deployment authorization, complete the initial image baseline and health acceptance, then create/merge/push the reviewed `staging` branches normally. The pipeline will run CI, publication, then digest deployment. Review artifacts/journals after the first authorized deployment. This repository task did not perform this step.

For future rollback recovery after power loss, take the same lock, inspect the protected journal's `previous` digests and any coordinator `.pending` file, restore only the affected image selectors, and use the established Compose flags with `up -d --no-deps --no-build --pull never --force-recreate` for the affected service only. Verify the documented health checks. Database migration failure/compatibility requires explicit manual review; never reset migrations, downgrade/delete data or restore over live databases automatically.
