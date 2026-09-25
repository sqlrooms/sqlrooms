import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeNotices} from './notices.mjs';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const cwd = path.join(repo, 'python/roomie');
function run(command, args, directory = repo) {
  const result = spawnSync(command, args, {cwd: directory, stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('pnpm', ['exec', 'turbo', 'build', '--filter=roomie-cli-app...']);
run(process.execPath, ['apps/roomie-cli-ui/build-contract.mjs']);
const target = path.join(cwd, 'roomie/static');
rmSync(target, {recursive: true, force: true});
mkdirSync(target, {recursive: true});
cpSync(path.join(repo, 'apps/roomie-cli-ui/dist'), target, {recursive: true});
const {version} = JSON.parse(
  readFileSync(path.join(cwd, 'package.json'), 'utf8'),
);
const plugin = path.join(
  cwd,
  'roomie/claude_plugin/.claude-plugin/plugin.json',
);
writeFileSync(
  plugin,
  JSON.stringify(
    {...JSON.parse(readFileSync(plugin, 'utf8')), version},
    null,
    2,
  ) + '\n',
);
writeFileSync(
  path.join(cwd, 'roomie/build.json'),
  JSON.stringify({application: 'roomie', version, schemaVersion: 1}) + '\n',
);
cpSync(path.join(cwd, 'LICENSE'), path.join(cwd, 'roomie/NOTICE'));
if (!process.argv.includes('--ui-only')) {
  writeNotices(repo, path.join(cwd, 'roomie/THIRD_PARTY_NOTICES.txt'));
  run('uv', ['build', '--out-dir', 'dist'], cwd);
  run(
    path.join(repo, 'python/.venv/bin/python'),
    ['scripts/verify_wheel.py'],
    cwd,
  );
}
