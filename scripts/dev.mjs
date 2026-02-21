import {spawnSync} from 'node:child_process';

/**
 * Dev entrypoint for this monorepo.
 *
 * Usage:
 * - `pnpm dev` -> run `dev` for `@sqlrooms/*`
 * - `pnpm dev <target>` -> run `dev` for `<target>` and its dependency graph
 *   by using Turbo's `<target>...` filter syntax.
 *
 * Any extra args are forwarded to Turbo (for example `--dry`).
 */
const [target, ...restArgs] = process.argv.slice(2);
const filter = target ? `${target}...` : '@sqlrooms/*';

const turboArgs = [
  'exec',
  'turbo',
  'run',
  'dev',
  '--concurrency=100',
  `--filter=${filter}`,
  ...restArgs,
];

const result = spawnSync('pnpm', turboArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
