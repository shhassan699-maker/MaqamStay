#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset BASH_ENV ENV NODE_OPTIONS NODE_PATH
# Installed root-owned; forced by authorized_keys. Never eval SSH_ORIGINAL_COMMAND.
deploy_pattern='^deploy (customer|inventory) ([a-f0-9]{40}) (sha256:[a-f0-9]{64}) (sha256:[a-f0-9]{64})$'
validate_pattern='^validate (customer|inventory) ([a-f0-9]{40})$'
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ $deploy_pattern ]]; then
  exec /usr/bin/sudo -n /usr/local/lib/maqamstay-cicd/entry.sh deploy \
    "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" "${BASH_REMATCH[4]}"
elif [[ ${SSH_ORIGINAL_COMMAND:-} =~ $validate_pattern ]]; then
  exec /usr/bin/sudo -n /usr/local/lib/maqamstay-cicd/entry.sh validate \
    "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
else
  exit 64
fi
