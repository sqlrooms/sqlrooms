import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash, randomUUID} from 'node:crypto';
import {realpath} from 'node:fs/promises';

const execute = promisify(execFile);
const docker = (args: string[]) =>
  execute('docker', args, {timeout: 30000, maxBuffer: 1024 * 1024});
const workspaceLabel = (directory: string) =>
  createHash('sha256').update(directory).digest('hex');
/** Remove only containers owned by this workspace before accepting new runs. */
export async function recoverIsolatedHarnesses(directory: string) {
  const label = workspaceLabel(await realpath(directory));
  const {stdout} = await docker([
    'ps',
    '--all',
    '--quiet',
    '--no-trunc',
    '--filter',
    `label=org.sqlrooms.workspace=${label}`,
  ]);
  for (const id of stdout.trim().split('\n').filter(Boolean)) {
    if (!/^[a-f0-9]{64}$/.test(id))
      throw new Error('Invalid recovery container identity.');
    await docker(['rm', '--force', id]);
  }
}
/** An immutable, locally built harness image. No implicit image pull or host environment inheritance. */
export type HarnessIsolation = {
  image: string;
  /** Explicit model API delegation only. Workspace/Quack/owner credentials are never accepted here. */
  modelEnvironment?: {OPENAI_API_KEY?: string; ANTHROPIC_API_KEY?: string};
};
/** Prepared process boundary shared by both native adapters. */
export type IsolatedHarnessProcess = {
  cwd: string;
  mcpUrl: string;
  mcpHost: string;
  spawn: (command: string, args: string[]) => ChildProcessWithoutNullStreams;
  kill: () => void;
  done: (child: ChildProcessWithoutNullStreams) => Promise<void>;
  dispose: () => Promise<void>;
};
/** Create an unprivileged, bounded container before any harness code can execute. */
export async function prepareIsolatedHarness(options: {
  isolation: HarnessIsolation;
  cwd: string;
  mcpUrl: string;
  token: string;
  workspaceDirectory: string;
  deadlineMs: number;
}): Promise<IsolatedHarnessProcess> {
  if (!/^sha256:[a-f0-9]{64}$/.test(options.isolation.image))
    throw new Error('Isolation requires a local immutable Docker image ID.');
  if (process.platform !== 'linux' && process.platform !== 'darwin')
    throw new Error(
      'Container isolation is supported on Linux and macOS only.',
    );
  const cwd = await realpath(options.cwd);
  if (cwd.includes(',')) throw new Error('Unsupported container mount path.');
  const uid = process.getuid!();
  if (uid === 0)
    throw new Error('Run the workspace host as an unprivileged OS user.');
  const address = new URL(options.mcpUrl);
  if (address.hostname !== '127.0.0.1' || address.pathname !== '/mcp')
    throw new Error('Expected the workspace loopback MCP endpoint.');
  const mcpHost = address.host;
  // Desktop forwards this gateway to host loopback. Linux uses the host network
  // only; PID, mount, user authority and IPC boundaries remain isolated.
  if (process.platform === 'darwin') address.hostname = 'host.docker.internal';
  const name = `roomie-${randomUUID()}`;
  let stdout: string;
  try {
    ({stdout} = await docker([
      'create',
      '--pull=never',
      '--interactive',
      '--init',
      '--name',
      name,
      '--label',
      `org.sqlrooms.workspace=${workspaceLabel(await realpath(options.workspaceDirectory))}`,
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--user',
      `${uid}:${process.getgid!()}`,
      '--pids-limit=128',
      '--memory=1g',
      '--memory-swap=1g',
      '--cpus=2',
      '--tmpfs',
      `/tmp:rw,nosuid,nodev,size=536870912,mode=1777`,
      ...(process.platform === 'linux'
        ? ['--network=host']
        : ['--network=bridge']),
      '--tmpfs',
      '/work:rw,nosuid,nodev,size=268435456,mode=1777',
      '--mount',
      `type=bind,source=${cwd},target=/run-input,readonly`,
      '--workdir=/work',
      '--entrypoint=node',
      options.isolation.image,
      '/opt/roomie/launch.mjs',
    ]));
  } catch (error) {
    // The daemon may have created it before the client lost the response.
    await docker(['rm', '--force', name]).catch(() => {});
    throw error;
  }
  const id = stdout.trim();
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new Error('Invalid container identity.');
  let removal: Promise<void> | undefined;
  const dispose = () =>
    (removal ??= docker(['rm', '--force', id]).then(() => {}));
  let launched = false;
  return {
    cwd: '/work',
    mcpUrl: address.href,
    mcpHost,
    spawn(command, args) {
      if (launched || removal)
        throw new Error('Container process already consumed.');
      launched = true;
      const child = spawn(
        'docker',
        ['start', '--attach', '--interactive', id],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        },
      );
      child.stdin.on('error', () => {});
      child.stdin.write(
        JSON.stringify({
          command,
          args,
          deadlineMs: options.deadlineMs,
          env: {
            ROOMIE_RUN_TOKEN: options.token,
            // Enumerate rather than spreading user objects or the host environment.
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
      void dispose().catch(() => {});
    },
    async done(child) {
      await new Promise<void>((resolve) =>
        child.once('close', () => resolve()),
      );
      await dispose();
    },
    dispose,
  };
}
