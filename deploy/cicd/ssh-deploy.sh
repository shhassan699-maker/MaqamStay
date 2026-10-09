#!/usr/bin/env bash
set -euo pipefail
[[ $# -eq 4 ]] || exit 64
[[ $1 == customer || $1 == inventory ]] || exit 64
[[ $2 =~ ^[a-f0-9]{40}$ && $3 =~ ^sha256:[a-f0-9]{64}$ && $4 =~ ^sha256:[a-f0-9]{64}$ ]] || exit 64
[[ ${STAGING_VPS_HOST:-} =~ ^[a-zA-Z0-9.-]+$ && ${STAGING_VPS_USER:-} =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 64
[[ $STAGING_VPS_USER != root ]] || exit 64
[[ -n ${STAGING_VPS_SSH_KEY:-} && -n ${STAGING_VPS_KNOWN_HOSTS:-} ]] || exit 64
umask 077
ssh_dir=$(mktemp -d)
trap 'rm -f -- "$ssh_dir/key" "$ssh_dir/known_hosts"; rmdir -- "$ssh_dir"' EXIT
printf '%s\n' "$STAGING_VPS_SSH_KEY" > "$ssh_dir/key"
printf '%s\n' "$STAGING_VPS_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
unset STAGING_VPS_SSH_KEY STAGING_VPS_KNOWN_HOSTS
ssh-keygen -F "$STAGING_VPS_HOST" -f "$ssh_dir/known_hosts" > /dev/null
# No agent forwarding, password fallback, accept-new, or key discovery in CI.
ssh -F /dev/null -T -i "$ssh_dir/key" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$ssh_dir/known_hosts" -o GlobalKnownHostsFile=/dev/null \
  -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no \
  -o ForwardAgent=no -o ClearAllForwardings=yes -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=120 \
  "$STAGING_VPS_USER@$STAGING_VPS_HOST" "deploy $1 $2 $3 $4" > deployment-evidence.json
