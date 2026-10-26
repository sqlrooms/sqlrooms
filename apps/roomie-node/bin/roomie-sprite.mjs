#!/usr/bin/env node
import {readFile, mkdir, realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createSpriteTasks} from '../service/sprite-tasks.mjs';
import {superviseHost} from '../service/watchdog.mjs';

// One trusted deployment configuration per Sprite. No credentials in this file.
async function main() {
  if (process.platform !== 'linux' || ![3, 4].includes(process.argv.length))
    throw Error('Usage: roomie-sprite <service-config.json> (Linux)');
  const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
  if (
    Object.keys(config).some(
      (key) =>
        ![
          'directory',
          'port',
          'publicOrigin',
          'harness',
          'image',
          'requestDeadlineMs',
          'runDeadlineMs',
        ].includes(key),
    )
  )
    throw Error('Unknown service configuration field.');
  if (typeof config.directory !== 'string' || !config.directory.startsWith('/'))
    throw Error('Workspace directory must be absolute.');
  if (
    !Number.isInteger(config.port) ||
    config.port < 1024 ||
    config.port > 65535
  )
    throw Error('Invalid service port.');
  if (
    config.publicOrigin &&
    (new URL(config.publicOrigin).protocol !== 'https:' ||
      new URL(config.publicOrigin).origin !== config.publicOrigin)
  )
    throw Error('Invalid service HTTPS origin.');
  if (config.harness && !['codex', 'claude'].includes(config.harness))
    throw Error('Invalid harness.');
  if (
    Boolean(config.harness) !== Boolean(config.image) ||
    (config.image && !/^sha256:[a-f0-9]{64}$/.test(config.image))
  )
    throw Error(
      'Managed harnesses require an immutable isolation image; trusted-local is forbidden.',
    );
  for (const [key, limit] of [
    ['requestDeadlineMs', 60000],
    ['runDeadlineMs', 3600000],
  ]) {
    if (
      config[key] !== undefined &&
      (!Number.isSafeInteger(config[key]) ||
        config[key] < 1000 ||
        config[key] > limit)
    )
      throw Error(`Invalid ${key}.`);
  }
  await mkdir(config.directory, {recursive: true, mode: 0o700});
  const directory = await realpath(config.directory);
  if (process.argv[3] !== '--locked') {
    // flock is released by the kernel on process death. Acquire it BEFORE
    // orphan recovery so a duplicate supervisor cannot kill an active run.
    const lock = spawn(
      'flock',
      [
        '--nonblock',
        '--no-fork',
        `${directory}/.service.lock`,
        process.execPath,
        fileURLToPath(import.meta.url),
        process.argv[2],
        '--locked',
      ],
      {stdio: 'inherit'},
    );
    const stop = () => lock.kill('SIGTERM');
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    try {
      const code = await new Promise((resolve, reject) => {
        lock.once('error', reject);
        lock.once('exit', (code) => resolve(code));
      });
      if (code !== 0)
        throw Error('Service ownership unavailable or supervisor failed.');
    } finally {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }
    return;
  }
  const args = [
    fileURLToPath(new URL('./roomie-node.mjs', import.meta.url)),
    directory,
    '--port',
    String(config.port),
  ];
  if (config.harness)
    args.push(
      '--harness',
      config.harness,
      '--isolation-image',
      config.image,
      '--deadline-ms',
      String(config.runDeadlineMs ?? 300000),
    );
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const cleanup = config.image
    ? async () =>
        (await import('../dist/index.mjs')).recoverIsolatedHarnesses(directory)
    : async () => {};
  try {
    // Bound repeated failures. The platform service can be restarted explicitly;
    // ordinary cold wake creates a fresh supervisor and recovers committed state.
    for (
      let attempt = 0;
      attempt < 3 && !controller.signal.aborted;
      attempt++
    ) {
      await superviseHost({
        tasks: createSpriteTasks(),
        cleanup,
        signal: controller.signal,
        requestDeadlineMs: config.requestDeadlineMs,
        runDeadlineMs: config.runDeadlineMs,
        report: (entry) => console.error(JSON.stringify(entry)),
        spawnHost: () =>
          spawn(process.execPath, args, {
            stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
            detached: true,
            env: {
              ...process.env,
              ROOMIE_MANAGED: '1',
              ROOMIE_PUBLIC_ORIGIN: config.publicOrigin ?? '',
            },
          }),
      });
    }
    if (!controller.signal.aborted)
      throw Error(
        'Host restart budget exhausted; inspect service logs before restarting.',
      );
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
main().catch((error) => {
  console.error(`Roomie service: ${error.message}`);
  process.exit(1); // No unbounded cleanup promise may keep a failed supervisor alive.
});
