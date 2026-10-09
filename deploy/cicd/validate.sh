#!/usr/bin/env bash
set -euo pipefail
# Pinned validator from its official release, verified against release checksums.
tool_dir=$(mktemp -d)
trap 'rm -f -- "$tool_dir/actionlint" "$tool_dir/actionlint.tar.gz"; rmdir -- "$tool_dir"' EXIT
release=https://github.com/rhysd/actionlint/releases/download/v1.7.12
curl --fail --silent --show-error --location "$release/actionlint_1.7.12_linux_amd64.tar.gz" -o "$tool_dir/actionlint.tar.gz"
expected=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
printf '%s  %s\n' "$expected" "$tool_dir/actionlint.tar.gz" | sha256sum --check --status
tar -xzf "$tool_dir/actionlint.tar.gz" -C "$tool_dir" actionlint
command -v shellcheck > /dev/null
shellcheck deploy/cicd/*.sh
for script in deploy/cicd/*.sh; do bash -n "$script"; done
"$tool_dir/actionlint" .github/workflows/*.yml
