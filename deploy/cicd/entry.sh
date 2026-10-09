#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset BASH_ENV ENV NODE_OPTIONS NODE_PATH
[[ $EUID -eq 0 && $# -eq 4 ]] || exit 64
[[ $1 == customer || $1 == inventory ]] || exit 64
[[ $2 =~ ^[a-f0-9]{40}$ && $3 =~ ^sha256:[a-f0-9]{64}$ && $4 =~ ^sha256:[a-f0-9]{64}$ ]] || exit 64
# One root-owned lock shared across both repositories. --close prevents Docker
# descendants from retaining the lock after the deployment process exits.
exec /usr/bin/flock --wait 600 --close /var/lib/maqamstay-cicd/deploy.lock \
  /usr/bin/timeout --signal=TERM --kill-after=600 1800 \
  /usr/bin/node /usr/local/lib/maqamstay-cicd/host.mjs "$@"
