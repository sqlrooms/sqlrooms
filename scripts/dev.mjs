import {spawn, spawnSync} from 'node:child_process';
import path from 'node:path';

/**
 * Dev entrypoint for this monorepo.
 *
 * Usage:
 * - `pnpm dev` -> run `dev` for `@sqlrooms/*`
 * - `pnpm dev <target>` -> build workspace dependencies first, then run
 *   dependency package watchers and the target dev server.
 *
 * Any extra args are forwarded to Turbo (for example `--dry`), except for the
 * `cli` target where they are forwarded to the Python CLI process.
 */
const rawArgs = process.argv.slice(2);
const hasTarget = rawArgs[0] && !rawArgs[0].startsWith('-');
const target = hasTarget ? rawArgs[0] : null;
const restArgs = hasTarget ? rawArgs.slice(1) : rawArgs;
const targetAliases = {
  cli: {
    packageName: 'sqlrooms-cli-python',
    targetDevFilters: ['sqlrooms-cli-python...', '!@sqlrooms/*'],
    dependencyFilters: ['sqlrooms-cli-python^...', '!sqlrooms-cli-app'],
  },
};
const targetConfig =
  target && targetAliases[target]
    ? targetAliases[target]
    : target
      ? {
          packageName: target,
          targetDevFilters: [target],
          dependencyFilters: [`${target}^...`],
        }
      : null;
const resolvedTarget = targetConfig?.packageName ?? null;
const filter = resolvedTarget ? `${resolvedTarget}...` : '@sqlrooms/*';

function unwrapForwardedArgs(args) {
  const separatorIndex = args.indexOf('--');
  if (separatorIndex === -1) return args;
  return args.slice(separatorIndex + 1);
}

const cliArgs = target === 'cli' ? unwrapForwardedArgs(restArgs) : [];
const turboArgsForTarget = target === 'cli' ? [] : restArgs;
const isDryRun = restArgs.some(
  (arg) => arg === '--dry' || arg.startsWith('--dry='),
);

const pnpmCommand = process.env.npm_execpath ?? 'pnpm';
const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
const extraPathDirs = process.env.npm_execpath
  ? [
      path.dirname(process.env.npm_execpath),
      path.resolve(
        path.dirname(process.env.npm_execpath),
        '..',
        '..',
        '..',
        'bin',
      ),
    ]
  : [];
const childPath = [...extraPathDirs, process.env[pathKey] ?? '']
  .filter(Boolean)
  .join(path.delimiter);
const childEnv = {
  ...process.env,
  [pathKey]: childPath,
  SQLROOMS_CLI_DEV_ARGS: JSON.stringify(cliArgs),
};

function turboRunArgs(task, filters, extraArgs = []) {
  return [
    'exec',
    'turbo',
    'run',
    task,
    '--concurrency=100',
    ...(target === 'cli' ? ['--env-mode=loose'] : []),
    ...filters.map((currentFilter) => `--filter=${currentFilter}`),
    ...extraArgs,
  ];
}

function runSync(args) {
  return spawnSync(pnpmCommand, args, {
    stdio: 'inherit',
    env: childEnv,
    shell: process.platform === 'win32',
  });
}

if (!targetConfig) {
  const result = runSync(turboRunArgs('dev', [filter], turboArgsForTarget));

  if (typeof result.status === 'number') {
    process.exit(result.status);
  }

  console.error('Failed to launch turbo dev command via pnpm.', result.error);
  process.exit(1);
}

const dryRunArgs = isDryRun
  ? restArgs.filter((arg) => arg === '--dry' || arg.startsWith('--dry='))
  : [];
const buildResult = runSync(
  turboRunArgs('build', targetConfig.dependencyFilters, dryRunArgs),
);

if (typeof buildResult.status === 'number' && buildResult.status !== 0) {
  process.exit(buildResult.status);
}

if (typeof buildResult.status !== 'number') {
  console.error(
    'Failed to launch turbo dependency build command via pnpm.',
    buildResult.error,
  );
  process.exit(1);
}

if (isDryRun) {
  const watchResult = runSync(
    turboRunArgs('dev', targetConfig.dependencyFilters, dryRunArgs),
  );

  if (typeof watchResult.status === 'number' && watchResult.status !== 0) {
    process.exit(watchResult.status);
  }

  if (typeof watchResult.status !== 'number') {
    console.error(
      'Failed to launch turbo dependency watcher dry run via pnpm.',
      watchResult.error,
    );
    process.exit(1);
  }

  const targetResult = runSync(
    turboRunArgs('dev', targetConfig.targetDevFilters, dryRunArgs),
  );

  if (typeof targetResult.status === 'number') {
    process.exit(targetResult.status);
  }

  console.error(
    'Failed to launch turbo target dev dry run via pnpm.',
    targetResult.error,
  );
  process.exit(1);
}

const children = new Set();
let exiting = false;

function stopChildren(signal = 'SIGTERM') {
  for (const child of children) {
    if (child.killed) continue;

    if (process.platform === 'win32') {
      child.kill(signal);
    } else {
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    }
  }
}

function startProcess(label, args, {allowCleanExit = false} = {}) {
  const child = spawn(pnpmCommand, args, {
    stdio: 'inherit',
    env: childEnv,
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
  });
  children.add(child);

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (exiting) return;

    if (allowCleanExit && code === 0) {
      return;
    }

    exiting = true;
    stopChildren();

    if (typeof code === 'number') {
      process.exit(code);
    }

    console.error(`${label} exited from signal ${signal}.`);
    process.exit(1);
  });

  child.on('error', (error) => {
    if (exiting) return;

    exiting = true;
    stopChildren();
    console.error(`Failed to launch ${label} via pnpm.`, error);
    process.exit(1);
  });

  return child;
}

process.on('SIGINT', () => {
  exiting = true;
  stopChildren('SIGINT');
  setTimeout(() => process.exit(130), 1000).unref();
});

process.on('SIGTERM', () => {
  exiting = true;
  stopChildren('SIGTERM');
  setTimeout(() => process.exit(143), 1000).unref();
});

startProcess(
  'turbo dependency dev watchers',
  turboRunArgs('dev', targetConfig.dependencyFilters),
  {allowCleanExit: true},
);
startProcess(
  'turbo target dev command',
  turboRunArgs('dev', targetConfig.targetDevFilters, turboArgsForTarget),
);
