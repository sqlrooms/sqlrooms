import {spawn} from 'node:child_process';
import type {IsolatedHarnessProcess} from './harnessIsolation';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import {z} from 'zod';
import {parse} from 'smol-toml';

const Message = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
});
/** Parsed native protocol envelope. Unknown events remain available to the projection. */
export type CodexMessage = z.infer<typeof Message>;
/** Bounded stdio adapter for Codex app-server 0.163.0. Owner approvals never auto-resolve. */
export function startCodex(options: {
  cwd: string;
  process?: IsolatedHarnessProcess;
  mcpUrl: string;
  token: string;
  executable?: string;
  model?: string;
  onMessage: (message: CodexMessage) => void;
  onExit: (reason: string) => void;
}) {
  // App-server merges tables with user config. Disable inherited servers/plugins
  // explicitly without modifying the owner's configuration or authentication.
  const overrides: string[] = [
    '-c',
    'features.apps=false',
    '-c',
    'features.plugins=false',
  ];
  try {
    const config = options.process
      ? {}
      : parse(
          readFileSync(
            join(
              process.env.CODEX_HOME ?? join(homedir(), '.codex'),
              'config.toml',
            ),
            'utf8',
          ),
        );
    const servers = config.mcp_servers;
    if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
      for (const name of Object.keys(servers))
        if (name !== 'roomie') {
          if (!/^[A-Za-z0-9_-]+$/.test(name))
            throw new Error('Unsupported inherited MCP configuration key.');
          overrides.push('-c', `mcp_servers.${name}.enabled=false`);
        }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const launch =
    options.process?.spawn ??
    ((command: string, args: string[]) =>
      spawn(command, args, {
        cwd: options.cwd,
        env: {...process.env, ROOMIE_RUN_TOKEN: options.token},
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      }));
  const child = launch(options.executable ?? 'codex', [
    'app-server',
    '--listen',
    'stdio://',
    '-c',
    `mcp_servers={roomie={url=${JSON.stringify(options.mcpUrl)},${options.process ? `http_headers={Host=${JSON.stringify(options.process.mcpHost)}},` : ''}bearer_token_env_var="ROOMIE_RUN_TOKEN",required=true,startup_timeout_sec=20,tool_timeout_sec=60}}`,
    '-c',
    'mcp_servers.roomie.default_tools_approval_mode="approve"',
    ...overrides,
  ]);
  let nextId = 0,
    buffered = '',
    bytes = 0,
    stopping = false;
  const decoder = new StringDecoder('utf8');
  const pending = new Map<
    number,
    {resolve: (value: unknown) => void; reject: (error: Error) => void}
  >();
  const done = options.process
    ? options.process.done(child)
    : new Promise<void>((resolve) => child.once('close', () => resolve()));
  const write = (value: unknown) => {
    if (stopping || child.stdin.destroyed) throw new Error('Harness stopped.');
    child.stdin.write(JSON.stringify(value) + '\n');
  };
  function kill(signal: NodeJS.Signals) {
    if (options.process) {
      options.process.kill();
      return;
    }
    if (!child.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  }
  function close(reason: string) {
    if (stopping) return;
    stopping = true;
    kill('SIGKILL');
    for (const waiter of pending.values()) waiter.reject(new Error(reason));
    pending.clear();
    options.onExit(reason);
  }
  child.stdin.on('error', () => close('Harness input closed.'));
  child.on('error', () => close('Could not start Codex app-server.'));
  child.on('close', () => close('Codex app-server exited.'));
  child.stderr.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 16 * 1024 * 1024) close('Harness output limit exceeded.');
  });
  child.stdout.on('data', (chunk: Buffer) => {
    try {
      bytes += chunk.length;
      buffered += decoder.write(chunk);
      if (
        bytes > 16 * 1024 * 1024 ||
        Buffer.byteLength(buffered) > 2 * 1024 * 1024
      )
        throw new Error('Harness output limit exceeded.');
      let index: number;
      while ((index = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, index);
        buffered = buffered.slice(index + 1);
        if (!line.trim()) continue;
        if (stopping) return;
        const message = Message.parse(JSON.parse(line));
        if (!message.method && typeof message.id === 'number') {
          const waiter = pending.get(message.id);
          pending.delete(message.id);
          if (message.error)
            waiter?.reject(
              new Error('Codex RPC failed: ' + JSON.stringify(message.error)),
            );
          else waiter?.resolve(message.result);
        } else options.onMessage(message);
      }
    } catch {
      close('Invalid or oversized Codex stream.');
    }
  });
  function request(method: string, params: unknown): Promise<unknown> {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, {resolve, reject});
      try {
        write({id, method, params});
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }
  return {
    done,
    reply(id: number | string, result: unknown) {
      write({id, result});
    },
    reject(id: number | string) {
      write({
        id,
        error: {
          code: -32601,
          message: 'Unsupported host request; permission not granted.',
        },
      });
    },
    async start(text: string, onThread: (id: string) => void) {
      await request('initialize', {
        clientInfo: {name: 'roomie', title: 'Roomie', version: '0.1.0'},
      });
      write({method: 'initialized', params: {}});
      // Verify the effective merged config before starting a thread or any tools.
      const effective = z
        .object({
          config: z.object({
            mcp_servers: z.record(
              z.string(),
              z.object({enabled: z.boolean().optional()}).passthrough(),
            ),
            features: z.object({
              plugins: z.literal(false),
              apps: z.literal(false),
            }),
          }),
        })
        .parse(
          await request('config/read', {
            includeLayers: false,
            cwd: options.cwd,
          }),
        );
      if (
        Object.entries(effective.config.mcp_servers).some(
          ([name, value]) => name !== 'roomie' && value.enabled !== false,
        )
      )
        throw new Error('Inherited MCP server remains enabled.');
      const thread = z.object({thread: z.object({id: z.string()})}).parse(
        await request('thread/start', {
          cwd: options.cwd,
          model: options.model,
          ephemeral: true,
          approvalPolicy: 'on-request',
          approvalsReviewer: 'user',
          sandbox: 'read-only',
          developerInstructions:
            'Use the roomie skill and the Roomie MCP commands for all workspace data and document work. Never inspect host files or credentials. Await owner decisions when approval is requested.',
        }),
      );
      onThread(thread.thread.id);
      await request('turn/start', {
        threadId: thread.thread.id,
        input: [{type: 'text', text: '$roomie\n\n' + text}],
      });
      return thread.thread.id;
    },
    stop() {
      close('Harness stopped by host.');
      return done;
    },
  };
}
