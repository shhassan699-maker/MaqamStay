#!/usr/bin/env bash
set -euo pipefail
# FUTURE ADMINISTRATOR EXAMPLE ONLY. Never invoked by CI or the forced dispatcher.
# Changes only Customer selector contents/permissions and a protected backup.
# No container/database mutation, pulls, migrations or Compose operations.
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset BASH_ENV ENV NODE_OPTIONS NODE_PATH
[[ $EUID -eq 0 && $# -eq 0 ]] || exit 64
umask 077
lock=/var/lib/maqamstay-cicd/deploy.lock
[[ -f $lock && -O $lock && ! -L $lock ]] || exit 64
[[ $(/usr/bin/stat -c '%a' -- "$lock") == 600 ]] || exit 64
exec 9< "$lock"
/usr/bin/flock --exclusive --wait 600 9
/usr/bin/node --input-type=module 9<&- <<'NODE'
import { readFile, open, chown, chmod } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { protectedPath, privateEnv, atomic } from '/usr/local/lib/maqamstay-cicd/host.mjs';
import { configuration, selectorSource } from '/usr/local/lib/maqamstay-cicd/configuration.mjs';
const exec = promisify(execFile);
async function docker(args) {
  const { stdout } = await exec('/usr/bin/docker', args, {
    env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', HOME: '/root' },
    timeout: 30000, maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}
try {
  await privateEnv('/var/lib/maqamstay-cicd/deploy.lock');
  await privateEnv('/etc/maqamstay-staging/cicd.json');
  const def = configuration(JSON.parse(await readFile('/etc/maqamstay-staging/cicd.json', 'utf8'))).deployments.customer;
  // 0644 may be normalized here, but root ownership/secure ancestry cannot be bypassed.
  const info = await protectedPath(def.imagesFile);
  if (info.nlink !== 1) throw Error('Aliased selector');
  const source = await readFile(def.imagesFile, 'utf8');
  const releaseLines = source.split(/\r?\n/).filter(line => line.startsWith('CUSTOMER_RELEASE_IMAGE='));
  if (releaseLines.length !== 1) throw Error('Ambiguous release selector');
  const releaseRef = releaseLines[0].slice('CUSTOMER_RELEASE_IMAGE='.length);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/@:-]*$/.test(releaseRef)) throw Error('Invalid existing release reference');
  const container = await docker(['ps', '-q', '--filter', `label=com.docker.compose.project=${def.project}`, '--filter', 'label=com.docker.compose.service=customer']);
  if (!/^[a-f0-9]{12,64}$/.test(container)) throw Error('Exactly one running Customer required');
  const inspect = format => docker(['inspect', '--format', format, container]);
  const health = () => inspect('{{.State.Running}} {{if .State.Health}}{{.State.Health.Status}}{{end}}');
  if (await health() !== 'true healthy') throw Error('Healthy Customer required');
  // .Image is the running container's content identity; .Config.Image is only its old tag.
  const runtimeId = await inspect('{{.Image}}');
  const releaseId = await docker(['image', 'inspect', '--format', '{{.Id}}', '--', releaseRef]);
  for (const id of [runtimeId, releaseId]) if (!/^sha256:[a-f0-9]{64}$/.test(id)) throw Error('Full local image identity required');
  if (await docker(['image', 'inspect', '--format', '{{.Id}}', '--', runtimeId]) !== runtimeId) throw Error('Runtime image not retained');
  const identity = await inspect('{{json .Mounts}} {{json .NetworkSettings.Networks}}');
  const candidate = source.split(/\r?\n/).map(line =>
    line.startsWith('CUSTOMER_IMAGE=') ? `CUSTOMER_IMAGE=${runtimeId}` :
    line.startsWith('CUSTOMER_RELEASE_IMAGE=') ? `CUSTOMER_RELEASE_IMAGE=${releaseId}` : line
  ).join('\n');
  selectorSource(candidate, def); // Same strict production parser, BEFORE any writes.
  if (await readFile(def.imagesFile, 'utf8') !== source) throw Error('Selector changed concurrently');
  const backup = await open(`${def.imagesFile}.before-immutable.${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}`, 'wx', 0o600);
  try { await backup.writeFile(source); await backup.sync(); } finally { await backup.close(); }
  await chown(def.imagesFile, 0, 0);
  await chmod(def.imagesFile, 0o600);
  await privateEnv(def.imagesFile);
  await atomic(def.imagesFile, candidate);
  await chown(def.imagesFile, 0, 0);
  await privateEnv(def.imagesFile);
  if (await inspect('{{.Image}}') !== runtimeId || await health() !== 'true healthy' || await inspect('{{json .Mounts}} {{json .NetworkSettings.Networks}}') !== identity) throw Error('Concurrent runtime change; manual review required');
  process.stdout.write('Customer selectors normalized; existing container/storage/network identity unchanged.\n');
} catch {
  // Never emit Docker stderr, selector contents, environment or exception values.
  process.stderr.write('Customer baseline normalization failed; review protected backup/pending state through the administrator console.\n');
  process.exitCode = 1;
}
NODE
