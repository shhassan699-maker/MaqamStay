#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset BASH_ENV ENV NODE_OPTIONS NODE_PATH
[[ $EUID -eq 0 && ( $# -eq 3 || $# -eq 5 ) ]] || exit 64
[[ $2 == customer || $2 == inventory ]] || exit 64
[[ $3 =~ ^[a-f0-9]{40}$ ]] || exit 64
case $1 in
  validate) [[ $# -eq 3 ]] || exit 64 ;;
  deploy) [[ $# -eq 5 && $4 =~ ^sha256:[a-f0-9]{64}$ && $5 =~ ^sha256:[a-f0-9]{64}$ ]] || exit 64 ;;
  *) exit 64 ;;
esac
# Open an EXISTING root-only lock read-only: validation cannot create it.
# The parent shell retains the lock; FD 9 is closed for Node/Docker descendants.
lock=/var/lib/maqamstay-cicd/deploy.lock
[[ -f $lock && -O $lock && ! -L $lock ]] || exit 64
[[ $(/usr/bin/stat -c '%a' -- "$lock") == 600 ]] || exit 64
exec 9< "$lock"
/usr/bin/flock --exclusive --wait 600 9
/usr/bin/timeout --signal=TERM --kill-after=600 1800 \
  /usr/bin/node /usr/local/lib/maqamstay-cicd/host.mjs "$@" 9<&-
