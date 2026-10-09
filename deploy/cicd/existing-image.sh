#!/usr/bin/env bash
set -euo pipefail
[[ $# -eq 2 && $1 =~ ^maqamstay-(customer|customer-release|inventory-api|inventory-admin)$ && $2 =~ ^[a-f0-9]{40}$ ]] || exit 64
: "${GITHUB_OUTPUT:?}"
work_dir=$(mktemp -d)
trap 'rm -f -- "$work_dir/manifest" "$work_dir/error"; rmdir -- "$work_dir"' EXIT
# Re-runs reuse a published full-SHA tag instead of overwriting it with a rebuild.
if docker buildx imagetools inspect "ghcr.io/shhassan699-maker/$1:$2" \
  --format '{{json .Manifest}}' > "$work_dir/manifest" 2> "$work_dir/error"; then
  digest=$(node -e 'const fs=require("node:fs");const manifest=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!/^sha256:[a-f0-9]{64}$/.test(manifest.digest))process.exit(1);process.stdout.write(manifest.digest)' "$work_dir/manifest")
  printf 'exists=true\ndigest=%s\n' "$digest" >> "$GITHUB_OUTPUT"
else
  # Auth, TLS, throttling and transport errors must not masquerade as absence.
  if ! grep -Eq 'manifest unknown|ghcr.io/shhassan699-maker/maqamstay-[a-z-]+:[a-f0-9]{40}: not found' "$work_dir/error"; then exit 1; fi
  printf 'exists=false\n' >> "$GITHUB_OUTPUT"
fi
