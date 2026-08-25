import {tmpdir} from 'node:os';
import path from 'node:path';

/** Read a separate or equals-form CLI option value. */
export function readOptionValue(args, name) {
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === name) return args[index + 1] ?? null;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return null;
}

/** Return whether a value-taking CLI option is present with a value. */
export function hasOption(args, name) {
  return readOptionValue(args, name) !== null;
}

/** Return whether Vite should proxy CLI WebSocket connections. */
export function shouldProxyCliDevWebSockets(
  args,
  {externalWsUrl = process.env.SQLROOMS_EXTERNAL_WS_URL} = {},
) {
  return !hasOption(args, '--external-ws-url') && !externalWsUrl;
}

/** Convert a wildcard bind host into a host clients can connect to. */
export function publicHost(host) {
  return host === '0.0.0.0' || host === '::' ? 'localhost' : host;
}

/** Format a host for use in a URL, including IPv6 brackets when needed. */
export function hostForUrl(host) {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

/** Resolve bind and backend-proxy hosts for CLI development. */
export function getCliDevHosts(args) {
  const host = readOptionValue(args, '--host') ?? '127.0.0.1';
  return {
    host,
    proxyHost: hostForUrl(publicHost(host)),
  };
}

/** Determine whether CLI arguments include a positional or option database path. */
export function hasDbPathArg(args) {
  if (
    readOptionValue(args, '--db-path') !== null ||
    readOptionValue(args, '-d') !== null
  ) {
    return true;
  }

  const optionsWithValue = new Set([
    '--config',
    '--db-path',
    '--external-url',
    '--external-ws-url',
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
      return index + 1 < args.length;
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

/** Build the Python CLI arguments used by the combined CLI development flow. */
export function getPythonCliDevArgs(args, apiPort, uiPort) {
  const hasDbPath = hasDbPathArg(args);
  const apiPortArgs = hasOption(args, '--port')
    ? args
    : ['--port', String(apiPort), ...args];
  const experimentalArgs = apiPortArgs.includes('--experimental')
    ? apiPortArgs
    : ['--experimental', ...apiPortArgs];
  return hasDbPath
    ? experimentalArgs
    : [
        '--db-path',
        path.join(tmpdir(), `sqlrooms-${uiPort}.db`),
        ...experimentalArgs,
      ];
}
