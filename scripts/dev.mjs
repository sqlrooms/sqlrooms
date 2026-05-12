import {spawnSync} from 'node:child_process';
import path from 'node:path';

/**
 * Dev entrypoint for this monorepo.
 *
 * Usage:
 * - `pnpm dev` -> run `dev` for `@sqlrooms/*`
 * - `pnpm dev <target>` -> run `dev` for `<target>` and its dependency graph
 *   by using Turbo's `<target>...` filter syntax.
 *
 * Any extra args are forwarded to Turbo (for example `--dry`), except for the
 * `cli` target where they are forwarded to the Python CLI process.
 */
const [target, ...restArgs] = process.argv.slice(2);
const targetAliases = {
  cli: 'sqlrooms-cli-python',
};
const resolvedTarget = target ? (targetAliases[target] ?? target) : null;
const filter = resolvedTarget ? `${resolvedTarget}...` : '@sqlrooms/*';

function unwrapForwardedArgs(args) {
  const separatorIndex = args.indexOf('--');
  if (separatorIndex === -1) return args;
  return args.slice(separatorIndex + 1);
}

const cliArgs = target === 'cli' ? unwrapForwardedArgs(restArgs) : [];
const turboArgsForTarget = target === 'cli' ? [] : restArgs;

const turboArgs = [
  'exec',
  'turbo',
  'run',
  'dev',
  '--concurrency=100',
  ...(target === 'cli' ? ['--env-mode=loose'] : []),
  `--filter=${filter}`,
  ...turboArgsForTarget,
];
const pnpmCommand = process.env.npm_execpath ?? 'pnpm';
const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
const extraPathDirs = process.env.npm_execpath
  ? [
      path.dirname(process.env.npm_execpath),
      path.resolve(path.dirname(process.env.npm_execpath), '..', '..', '..', 'bin'),
    ]
  : [];
const childPath = [...extraPathDirs, process.env[pathKey] ?? '']
  .filter(Boolean)
  .join(path.delimiter);

const result = spawnSync(pnpmCommand, turboArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    [pathKey]: childPath,
    SQLROOMS_CLI_DEV_ARGS: JSON.stringify(cliArgs),
  },
  shell: process.platform === 'win32',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

console.error('Failed to launch turbo dev command via pnpm.', result.error);
process.exit(1);
