import {fileURLToPath} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import {waitForCliApi} from './cli-dev-readiness.mjs';
import {python, setup} from '../python/roomie/scripts/dev_setup.mjs';

/** Fixed loopback development origins fail clearly if another process owns a port. */
export async function devRoomie(args) {
  const api = 'http://127.0.0.1:4274';
  const ui = 'http://127.0.0.1:3200';
  args = args.filter((arg) => arg !== '--');
  if (args.includes('--dry')) {
    console.log(
      'Build roomie-cli-app dependencies, install paired Python stack, start Roomie API and Vite, then verify binding and issue an authenticated page ticket.',
    );
    console.log(
      `API: ${api}; UI: ${ui}; open browser: ${!args.includes('--no-open-browser')}`,
    );
    return;
  }
  if (
    args.some(
      (arg) =>
        arg === '--port' ||
        arg.startsWith('--port=') ||
        arg.startsWith('--external-url'),
    )
  )
    throw new Error(
      'Roomie dev reserves API port 4274 and UI port 3200. Use the packaged CLI for custom ports.',
    );
  setup();
  const build = spawnSync(
    'pnpm',
    ['exec', 'turbo', 'build', '--filter=roomie-cli-app^...'],
    {stdio: 'inherit'},
  );
  if (build.status !== 0) process.exit(build.status ?? 1);
  const children = new Set();
  const controller = new AbortController();
  let stopping = false;
  const stop = () => {
    stopping = true;
    controller.abort();
    for (const child of children) child.kill('SIGTERM');
  };
  const start = (command, argv, options = {}) => {
    const child = spawn(command, argv, {stdio: 'inherit', ...options});
    children.add(child);
    child.once('error', (error) => {
      console.error(error);
      process.exitCode = 1;
      stop();
    });
    child.once('exit', (code) => {
      children.delete(child);
      if (!stopping) {
        process.exitCode = code || 1;
        stop();
      }
    });
    return child;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const backend = start(python, [
      '-m',
      'roomie',
      ...args,
      '--port',
      '4274',
      '--external-url',
      ui,
      '--no-open-browser',
    ]);
    await waitForCliApi(api + '/healthz', {signal: controller.signal});
    start(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        '--host',
        '127.0.0.1',
        '--port',
        '3200',
        '--strictPort',
      ],
      {
        cwd: 'apps/roomie-cli-ui',
        env: {...process.env, ROOMIE_API_URL: api},
      },
    );
    await waitForCliApi(ui, {signal: controller.signal});
    const launch = spawnSync(
      python,
      [
        'python/roomie/scripts/open_dev.py',
        api,
        '--pid',
        String(backend.pid),
        ...(args.includes('--no-open-browser') ? ['--no-open-browser'] : []),
      ],
      {stdio: 'inherit'},
    );
    if (launch.status !== 0)
      throw new Error('Authenticated Roomie development launch failed.');
  } catch (error) {
    if (!stopping) {
      console.error(error);
      process.exitCode = 1;
      stop();
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await devRoomie(process.argv.slice(2));
}
