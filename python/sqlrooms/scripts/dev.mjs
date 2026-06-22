import {spawnSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const defaultArgs = ['run', 'sqlrooms', '--no-open-browser', '--no-ui'];

function getForwardedArgs() {
  const raw = process.env.SQLROOMS_CLI_DEV_ARGS;
  if (!raw) return unwrapForwardedArgs(process.argv.slice(2));

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? unwrapForwardedArgs(parsed.map(String)) : [];
  } catch {
    return [];
  }
}

function unwrapForwardedArgs(args) {
  const separatorIndex = args.indexOf('--');
  if (separatorIndex === -1) return args;
  return args.slice(separatorIndex + 1);
}

function readOptionValue(args, name) {
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === name) return args[index + 1] ?? null;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return null;
}

const forwardedArgs = getForwardedArgs();

function createDefaultDbPath() {
  const defaultDbDir = mkdtempSync(path.join(tmpdir(), 'sqlrooms-'));
  return path.join(defaultDbDir, 'sqlrooms.db');
}

// Keep the standalone dev API aligned with the Vite proxy default. Production
// `sqlrooms` still starts from the public CLI app port when --port is omitted.
const portArgs =
  readOptionValue(forwardedArgs, '--port') === null ? ['--port', '4273'] : [];
const dbPathArgs =
  readOptionValue(forwardedArgs, '--db-path') === null &&
  readOptionValue(forwardedArgs, '-d') === null
    ? ['--db-path', createDefaultDbPath()]
    : [];

const result = spawnSync(
  'uv',
  [...defaultArgs, ...portArgs, ...dbPathArgs, ...forwardedArgs],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

console.error('Failed to launch sqlrooms CLI dev server via uv.', result.error);
process.exit(1);
