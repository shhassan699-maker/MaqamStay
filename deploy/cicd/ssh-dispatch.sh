#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset BASH_ENV ENV NODE_OPTIONS NODE_PATH
# Installed root-owned; forced by authorized_keys. Never eval SSH_ORIGINAL_COMMAND.
pattern='^deploy (customer|inventory) ([a-f0-9]{40}) (sha256:[a-f0-9]{64}) (sha256:[a-f0-9]{64})$'
[[ ${SSH_ORIGINAL_COMMAND:-} =~ $pattern ]] || exit 64
exec /usr/bin/sudo -n /usr/local/lib/maqamstay-cicd/entry.sh \
  "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" "${BASH_REMATCH[4]}"
