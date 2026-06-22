import {spawn, spawnSync} from 'node:child_process';
import net from 'node:net';
import {tmpdir} from 'node:os';
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
    packageName: 'sqlrooms-python',
    targetDevFilters: ['sqlrooms-python...', '!@sqlrooms/*'],
    dependencyFilters: ['sqlrooms-python^...', '!sqlrooms-cli-app'],
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

function getControlArgs(args) {
  const separatorIndex = args.indexOf('--');
  if (separatorIndex === -1) return args;
  return args.slice(0, separatorIndex);
}

const controlArgs = getControlArgs(restArgs);
const forwardedCliArgs =
  restArgs.indexOf('--') === -1
    ? controlArgs.filter((arg) => arg !== '--dry' && !arg.startsWith('--dry='))
    : unwrapForwardedArgs(restArgs);
const cliArgs = target === 'cli' ? forwardedCliArgs : [];
const turboArgsForTarget = target === 'cli' ? [] : restArgs;
const isDryRun = controlArgs.some(
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
const CLI_DEV_API_DEFAULT_PORT = 4273;
const CLI_DEV_UI_DEFAULT_PORT = 3100;

function readOptionValue(args, name) {
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === name) return args[index + 1] ?? null;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return null;
}

function hasOption(args, name) {
  return readOptionValue(args, name) !== null;
}

function publicHost(host) {
  return host === '0.0.0.0' || host === '::' ? 'localhost' : host;
}

function hostForUrl(host) {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function portProbeHosts(host) {
  return host === 'localhost' ? ['127.0.0.1', '::1'] : [host];
}

async function isPortAvailableOnHost(
  host,
  port,
  {ignoreUnavailable = false} = {},
) {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        resolve(false);
        return;
      }
      if (
        ignoreUnavailable &&
        (error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT')
      ) {
        resolve(true);
        return;
      }
      reject(error);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function isPortAvailable(host, port) {
  const probeHosts = portProbeHosts(host);
  const results = await Promise.all(
    probeHosts.map((probeHost) =>
      isPortAvailableOnHost(probeHost, port, {
        ignoreUnavailable: host === 'localhost',
      }),
    ),
  );
  return results.every(Boolean);
}

async function findAvailablePort(startPort, host, reservedPorts = new Set()) {
  let port = startPort;
  while (port <= 65535) {
    if (!reservedPorts.has(port) && (await isPortAvailable(host, port))) {
      return port;
    }
    console.log(`Port ${port} is in use, trying another one...`);
    port += 1;
  }
  throw new Error(`No available port found starting from ${startPort}.`);
}

function parsePortOption(args, name) {
  const value = readOptionValue(args, name);
  if (value === null) return null;
  const port = Number.parseInt(value, 10);
  return Number.isFinite(port) ? port : null;
}

function hasDbPathArg(args) {
  if (
    readOptionValue(args, '--db-path') !== null ||
    readOptionValue(args, '-d') !== null
  ) {
    return true;
  }

  const optionsWithValue = new Set([
    '--config',
    '--db-path',
    '--host',
    '--meta-db',
    '--meta-namespace',
    '--port',
    '--ui',
    '--ws-port',
    '-d',
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      return args.slice(index + 1).some((value) => !value.startsWith('-'));
    }
    if (arg.startsWith('--') && arg.includes('=')) continue;
    if (optionsWithValue.has(arg)) {
      index += 1;
      continue;
    }
    if (!arg.startsWith('-')) return true;
  }

  return false;
}

async function getCliDevPorts(args) {
  const host = readOptionValue(args, '--host') ?? '127.0.0.1';
  const proxyHost = hostForUrl(publicHost(host));
  const explicitApiPort = parsePortOption(args, '--port');
  const explicitWsPort = parsePortOption(args, '--ws-port');
  const reservedPorts = new Set(
    [CLI_DEV_UI_DEFAULT_PORT, explicitWsPort].filter(
      (port) => typeof port === 'number',
    ),
  );
  const apiPort =
    explicitApiPort ??
    (await findAvailablePort(CLI_DEV_API_DEFAULT_PORT, host, reservedPorts));
  const uiReservedPorts = new Set(
    [apiPort, explicitWsPort].filter((port) => typeof port === 'number'),
  );
  const uiPort = await findAvailablePort(
    CLI_DEV_UI_DEFAULT_PORT,
    '0.0.0.0',
    uiReservedPorts,
  );
  return {apiPort, proxyHost, uiPort};
}

function getPythonCliDevArgs(args, apiPort, uiPort) {
  const apiPortArgs = hasOption(args, '--port')
    ? args
    : ['--port', String(apiPort), ...args];
  return hasDbPathArg(apiPortArgs)
    ? apiPortArgs
    : [
        '--db-path',
        path.join(tmpdir(), `sqlrooms-${uiPort}.db`),
        ...apiPortArgs,
      ];
}

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

if (target !== 'cli') {
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
} else if (isDryRun) {
  const {apiPort, proxyHost, uiPort} = await getCliDevPorts(cliArgs);
  const pythonCliArgs = getPythonCliDevArgs(cliArgs, apiPort, uiPort);
  console.log(
    `(cd apps/sqlrooms-cli-ui && SQLROOMS_CLI_API_PROXY_TARGET=http://${proxyHost}:${apiPort} ./node_modules/.bin/vite --host --port ${uiPort})`,
  );
  console.log(
    `(cd python/sqlrooms && SQLROOMS_CLI_DEV_ARGS=${JSON.stringify(
      pythonCliArgs,
    )} node scripts/dev.mjs)`,
  );
  process.exit(0);
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

function startProcess(
  label,
  args,
  {
    allowCleanExit = false,
    command = pnpmCommand,
    cwd = process.cwd(),
    env = {},
  } = {},
) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: {...childEnv, ...env},
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
    console.error(`Failed to launch ${label}.`, error);
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

if (target === 'cli') {
  const {apiPort, proxyHost, uiPort} = await getCliDevPorts(cliArgs);
  const pythonCliArgs = getPythonCliDevArgs(cliArgs, apiPort, uiPort);
  startProcess(
    'sqlrooms CLI UI dev server',
    ['--host', '--port', String(uiPort)],
    {
      command: path.resolve('apps/sqlrooms-cli-ui', 'node_modules/.bin/vite'),
      cwd: path.resolve('apps/sqlrooms-cli-ui'),
      env: {
        SQLROOMS_CLI_API_PROXY_TARGET: `http://${proxyHost}:${apiPort}`,
      },
    },
  );
  startProcess('sqlrooms Python CLI dev server', ['scripts/dev.mjs'], {
    command: process.execPath,
    cwd: path.resolve('python/sqlrooms'),
    env: {
      SQLROOMS_CLI_DEV_ARGS: JSON.stringify(pythonCliArgs),
    },
  });
} else {
  startProcess(
    'turbo dependency dev watchers',
    turboRunArgs('dev', targetConfig.dependencyFilters),
    {allowCleanExit: true},
  );
  startProcess(
    'turbo target dev command',
    turboRunArgs('dev', targetConfig.targetDevFilters, turboArgsForTarget),
  );
}
