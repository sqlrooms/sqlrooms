import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
export const python = path.join(repo, 'python/.venv/bin/python');
/** Install the paired stack locally; published Roomie requires its upstream release. */
export function setup() {
  for (const args of [
    ['sync', '--project', 'python', '--package', 'sqlrooms', '--group', 'dev'],
    ['pip', 'install', '--python', python, '--no-deps', '-e', 'python/roomie'],
  ]) {
    const result = spawnSync('uv', args, {cwd: repo, stdio: 'inherit'});
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) setup();
