#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readFile, stat} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const help = `Usage: roomie-node <workspace-directory> [options]

Serve a persistent workspace on loopback until Ctrl-C. No harness by default.
  --open                   Open a fresh single-use sign-in link in your browser
  --port <0-65535>          Listener port (default: an available port)
  --harness <codex|claude>  Enable a harness; requires one mode below
  --trusted-local          Harness shell has your OS authority (not isolated)
  --isolation-image <id>   Local immutable Docker sha256 image ID
  --bubblewrap-runtime <dir> Linux runtime provisioned by bubblewrap/provision.sh
  --deadline-ms <ms>       Run deadline (1000-3600000; default: 300000)
  --help                   Show help
  --version                Show version

Requires Node 24.9–24.x on macOS or Linux. Python is not required.
Quack is disabled. Container mode delegates only explicit OPENAI_API_KEY or
ANTHROPIC_API_KEY environment variables; it never copies personal login files.
`;

async function main() {
  const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {
      open: {type: 'boolean'},
      port: {type: 'string', default: '0'},
      harness: {type: 'string'},
      'trusted-local': {type: 'boolean'},
      'isolation-image': {type: 'string'},
      'bubblewrap-runtime': {type: 'string'},
      'deadline-ms': {type: 'string', default: '300000'},
      help: {type: 'boolean'},
      version: {type: 'boolean'},
    },
  });
  if (values.help) return console.log(help);
  if (values.version)
    return console.log(
      JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version,
    );
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 9) throw Error('Roomie requires Node 24.9–24.x.');
  if (!['darwin', 'linux'].includes(process.platform))
    throw Error('Roomie currently supports macOS and Linux.');
  if (positionals.length !== 1)
    throw Error('Specify one workspace directory. Use --help for usage.');
  const integer = (value, min, max, name) => {
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max)
      throw Error(`Invalid ${name}: expected ${min}–${max}.`);
    return Number(value);
  };
  const port = integer(values.port, 0, 65535, 'port');
  const deadlineMs = integer(values['deadline-ms'], 1000, 3600000, 'deadline');
  const adapter = values.harness;
  const image = values['isolation-image'];
  const runtimeDirectory = values['bubblewrap-runtime'];
  if (adapter && !['codex', 'claude'].includes(adapter))
    throw Error('Harness must be codex or claude.');
  if (
    adapter
      ? [values['trusted-local'], image, runtimeDirectory].filter(Boolean)
          .length !== 1
      : values['trusted-local'] || image || runtimeDirectory
  )
    throw Error(
      'Choose --harness codex|claude with exactly one of --trusted-local, --isolation-image or --bubblewrap-runtime.',
    );
  if (image && !/^sha256:[a-f0-9]{64}$/.test(image))
    throw Error('Isolation requires a local immutable Docker sha256 image ID.');
  const uiDirectory = resolve(root, 'dist/ui');
  if (
    !(await stat(resolve(uiDirectory, 'node.html')).catch(() => null))?.isFile()
  )
    throw Error(
      'Built browser UI is missing. Build or reinstall the Roomie distribution.',
    );
  const directory = resolve(positionals[0]);
  const managed = process.env.ROOMIE_MANAGED === '1';
  if (managed && (values['trusted-local'] || values.open))
    throw Error(
      'Managed service forbids trusted-local harnesses and browser opening.',
    );
  const lifecycle = managed
    ? (await import('../service/lease-client.mjs')).connectExecutionLifecycle()
    : undefined;
  let startup;
  let workspace,
    server,
    stopping = false;
  let signal;
  const stopped = new Promise((done) => {
    signal = () => {
      stopping = true;
      done();
    };
  });
  process.on('SIGINT', signal);
  process.on('SIGTERM', signal);
  try {
    const {openWorkspace, startWorkspaceServer} =
      await import('../dist/index.mjs');
    startup = await lifecycle?.acquire('startup', 120000);
    workspace = await openWorkspace({directory});
    if (stopping) return;
    server = await startWorkspaceServer({
      workspace,
      port,
      uiDirectory,
      lifecycle,
      publicOrigin: managed ? process.env.ROOMIE_PUBLIC_ORIGIN : undefined,
      harness: adapter
        ? {
            adapter,
            deadlineMs,
            ...(image || runtimeDirectory
              ? {
                  isolation: {
                    ...(image
                      ? {image}
                      : {
                          backend: 'bubblewrap',
                          runtimeDirectory: resolve(runtimeDirectory),
                        }),
                    modelEnvironment: {
                      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
                      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
                    },
                  },
                }
              : {trustedLocal: true}),
          }
        : undefined,
    });
    if (stopping) return;
    const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
    const response = await fetch(`${server.url}/api/auth/ticket`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
    });
    if (!response.ok)
      throw Error(`Browser sign-in failed (${response.status}).`);
    const {url} = await response.json();
    console.log(
      JSON.stringify({
        url: server.url,
        directory,
        credentialPath: server.credentialPath,
      }),
    );
    console.log(`Browser sign-in (single use, expires in 2 minutes): ${url}`);
    console.log(
      `Harness: ${adapter ? `${adapter} (${image ? 'container isolation' : runtimeDirectory ? 'Bubblewrap isolation (no aggregate resource quotas)' : 'trusted local: shell has your OS authority'})` : 'disabled'}. Quack: disabled. Stop with Ctrl-C.`,
    );
    if (values.open) {
      const browser = spawn(
        process.platform === 'darwin' ? 'open' : 'xdg-open',
        [url],
        {stdio: 'ignore'},
      );
      browser.on('error', () =>
        console.error(
          'Could not open the browser; use the sign-in link above.',
        ),
      );
      browser.on('exit', (code) => {
        if (code)
          console.error('Browser opener failed; use the sign-in link above.');
      });
      browser.unref();
    }
    await startup?.();
    startup = undefined;
    lifecycle?.ready();
    await stopped;
  } finally {
    const releaseShutdown = await lifecycle?.acquire('shutdown');
    try {
      await server?.dispose();
    } finally {
      await workspace?.dispose();
    }
    await startup?.();
    await releaseShutdown?.();
    lifecycle?.close();
    process.off('SIGINT', signal);
    process.off('SIGTERM', signal);
  }
}
main().catch((error) => {
  console.error(`Roomie: ${error.message}`);
  process.exitCode = 1;
});
