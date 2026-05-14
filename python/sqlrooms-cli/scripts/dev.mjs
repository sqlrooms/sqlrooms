import {spawnSync} from 'node:child_process';

const defaultArgs = [
  'run',
  'sqlrooms',
  '--ws-port',
  '4000',
  '--port',
  '4173',
  '--no-open-browser',
  '--db-path',
  '/tmp/sqlrooms-cli.db',
];

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

const result = spawnSync('uv', [...defaultArgs, ...getForwardedArgs()], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

console.error('Failed to launch sqlrooms CLI dev server via uv.', result.error);
process.exit(1);
