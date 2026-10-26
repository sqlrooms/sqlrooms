import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  stat,
  unlink,
} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import type {
  HarnessIsolation,
  IsolatedHarnessProcess,
} from './harnessIsolation';

const registry = (directory: string) => join(directory, '.bubblewrap');
async function identity(pid: number, includeZombie = false) {
  const value = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '');
  const fields = value.slice(value.lastIndexOf(')') + 2).split(' ');
  return !includeZombie && fields[0] === 'Z' ? undefined : fields[19];
}
/** Recover only this boot/PID namespace and positively identified run processes. */
export async function recoverBubblewrapHarnesses(directory: string) {
  if (process.platform !== 'linux') throw Error('Bubblewrap requires Linux.');
  const folder = registry(directory);
  for (const name of await readdir(folder).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  )) {
    if (/^[a-f0-9-]{36}\.json\.pending$/.test(name)) {
      await unlink(join(folder, name));
      continue; // An unpublished record never authorizes child startup.
    }
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
    const path = join(folder, name);
    const record = JSON.parse(await readFile(path, 'utf8')) as {
      pid: number;
      start: string;
      boot: string;
      hostNamespace: string;
      nonce: string;
      namespace?: {pid: number; start: string};
    };
    if (
      !Number.isSafeInteger(record.pid) ||
      record.pid <= 1 ||
      !/^\d+$/.test(record.start) ||
      record.nonce !== name.slice(0, -5) ||
      typeof record.boot !== 'string' ||
      typeof record.hostNamespace !== 'string'
    )
      throw Error('Invalid Bubblewrap recovery record.');
    const boot = await readFile('/proc/sys/kernel/random/boot_id', 'utf8');
    if (record.boot !== boot) {
      await unlink(path);
      await unlink(path.replace(/\.json$/, '.sock')).catch(() => {});
      continue; // No process from a previous kernel boot can survive.
    }
    if (record.hostNamespace !== (await readlink('/proc/self/ns/pid')))
      throw Error('Bubblewrap recovery PID namespace changed.');
    // A startup group can outlive its runner. Numeric PGID alone is never proof
    // of ownership: only signal members carrying the trusted per-run marker.
    for (const candidate of (await readdir('/proc')).filter((p) =>
      /^\d+$/.test(p),
    )) {
      const pid = Number(candidate);
      const value = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '');
      const fields = value.slice(value.lastIndexOf(')') + 2).split(' ');
      if (Number(fields[2]) !== record.pid || fields[0] === 'Z') continue;
      const environment = await readFile(`/proc/${pid}/environ`).catch(
        () => undefined,
      );
      if (
        !environment
          ?.toString()
          .split('\0')
          .includes(`ROOMIE_BWRAP_RUN=${record.nonce}`)
      )
        continue;
      const owner = await stat(`/proc/${pid}`).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT' || error.code === 'ESRCH')
            return undefined;
          throw error;
        },
      );
      if (!owner) continue;
      if (owner.uid !== process.getuid!())
        throw Error('Unexpected Bubblewrap process owner.');
      if ((await identity(pid)) !== fields[19]) continue;
      try {
        process.kill(pid, 'SIGKILL');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
      for (let n = 0; n < 200 && (await identity(pid)) === fields[19]; n++)
        await delay(25);
      if ((await identity(pid)) === fields[19])
        throw Error('Bubblewrap startup cleanup deadline exceeded.');
    }
    if (record.namespace) {
      const {pid, start} = record.namespace;
      if (!Number.isSafeInteger(pid) || pid <= 1 || !/^\d+$/.test(start))
        throw Error('Invalid namespace recovery identity.');
      const owner = await stat(`/proc/${pid}`).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT' || error.code === 'ESRCH')
            return undefined;
          throw error;
        },
      );
      if (owner && (await identity(pid)) === start) {
        if (owner.uid !== process.getuid!())
          throw Error('Unexpected namespace owner.');
        try {
          process.kill(pid, 'SIGKILL');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        }
        for (let n = 0; n < 200 && (await identity(pid)) === start; n++)
          await delay(25);
        if ((await identity(pid)) === start)
          throw Error('Namespace cleanup deadline exceeded.');
      }
    }
    await unlink(path).catch(() => {});
    await unlink(path.replace(/\.json$/, '.sock')).catch(() => {});
  }
}

/** Prepare a Linux namespace boundary; startup failure never selects trusted-local mode. */
export async function prepareBubblewrapHarness(options: {
  isolation: Extract<HarnessIsolation, {backend: 'bubblewrap'}>;
  cwd: string;
  mcpUrl: string;
  token: string;
  workspaceDirectory: string;
  deadlineMs: number;
}): Promise<IsolatedHarnessProcess> {
  if (process.platform !== 'linux' || process.getuid!() === 0)
    throw Error('Bubblewrap requires an unprivileged Linux host.');
  const target = new URL(options.mcpUrl);
  if (
    target.hostname !== '127.0.0.1' ||
    target.pathname !== '/mcp' ||
    target.protocol !== 'http:'
  )
    throw Error('Expected workspace loopback MCP endpoint.');
  const runtimeDirectory = await realpath(options.isolation.runtimeDirectory);
  for (const executable of ['node', 'bwrap', 'codex', 'claude']) {
    const path = await realpath(join(runtimeDirectory, 'bin', executable));
    if (!path.startsWith(runtimeDirectory + '/'))
      throw Error('Harness runtime symlinks must stay inside the runtime.');
    if (!(await stat(path)).isFile())
      throw Error('Missing harness runtime executable.');
  }
  const folder = registry(await realpath(options.workspaceDirectory));
  await mkdir(folder, {recursive: true, mode: 0o700});
  const id = randomUUID();
  const record = join(folder, `${id}.json`);
  const socket = join(folder, `${id}.sock`);
  if (Buffer.byteLength(socket) > 103)
    throw Error('Workspace path too long for Bubblewrap broker socket.');
  let child: ChildProcessWithoutNullStreams | undefined;
  let completion: Promise<void> | undefined;
  let disposed = false;
  return {
    cwd: '/work',
    mcpUrl: 'http://127.0.0.1:43100/mcp',
    mcpHost: '127.0.0.1:43100',
    spawn(command, args) {
      if (child || disposed) throw Error('Boundary already consumed.');
      child = spawn(
        process.execPath,
        [
          fileURLToPath(new URL('../bubblewrap/runner.mjs', import.meta.url)),
          record,
          socket,
        ],
        {
          detached: true,
          stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
          env: {PATH: '/usr/bin:/bin', ROOMIE_BWRAP_RUN: id},
        },
      ) as ChildProcessWithoutNullStreams;
      completion = new Promise<void>((resolve) => {
        child!.once('close', () => resolve());
      });
      child.stdin.on('error', () => {});
      child.stdin.write(
        JSON.stringify({
          runtimeDirectory,
          cwd: options.cwd,
          mcpUrl: options.mcpUrl,
          token: options.token,
          modelOrigins: options.isolation.modelOrigins,
          deadlineMs: options.deadlineMs,
          command,
          args,
          env: {
            ROOMIE_RUN_TOKEN: options.token,
            ...(options.isolation.modelEnvironment?.OPENAI_API_KEY
              ? {
                  OPENAI_API_KEY:
                    options.isolation.modelEnvironment.OPENAI_API_KEY,
                }
              : {}),
            ...(options.isolation.modelEnvironment?.ANTHROPIC_API_KEY
              ? {
                  ANTHROPIC_API_KEY:
                    options.isolation.modelEnvironment.ANTHROPIC_API_KEY,
                }
              : {}),
          },
        }) + '\n',
      );
      return child;
    },
    kill() {
      child?.kill('SIGTERM');
    },
    async done() {
      await completion;
    },
    async dispose() {
      disposed = true;
      child?.kill('SIGTERM');
      await completion;
    },
  };
}
