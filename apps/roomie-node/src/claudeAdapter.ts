import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import {z} from 'zod';
import type {HarnessAdapter, HarnessAdapterOptions} from './harnessAdapter';

const Envelope = z.object({type: z.string()}).passthrough();
const Permission = z.object({
  subtype: z.literal('can_use_tool'),
  tool_name: z.string(),
  tool_use_id: z.string(),
  input: z.record(z.string(), z.unknown()),
});
const roomieTools = new Set(
  ['search_commands', 'get_command', 'execute_command', 'query'].map(
    (name) => `mcp__roomie__${name}`,
  ),
);

/** Bounded Claude Code 2.1.310 stream-json adapter. All native permission requests wait for the owner. */
export function startClaude(options: HarnessAdapterOptions): HarnessAdapter {
  const config = JSON.stringify({
    mcpServers: {
      roomie: {
        type: 'http',
        url: options.mcpUrl,
        headers: {Authorization: 'Bearer ${ROOMIE_RUN_TOKEN}'},
      },
    },
  });
  const child = spawn(
    options.executable ?? 'claude',
    [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--no-session-persistence',
      '--restricted',
      '--setting-sources',
      '',
      '--settings',
      '{"disableAllHooks":true,"disableBundledSkills":true}',
      '--tools',
      'Skill',
      '--plugin-dir',
      join(options.cwd, '.claude'),
      '--no-chrome',
      '--strict-mcp-config',
      '--mcp-config',
      config,
      '--permission-mode',
      'manual',
      '--permission-prompt-tool',
      'stdio',
      '--max-turns',
      '48',
      '--append-system-prompt',
      'Use the roomie skill and Roomie MCP commands for all workspace work. Await owner approvals. Never inspect host data or credentials.',
      ...(options.model ? ['--model', options.model] : []),
    ],
    {
      cwd: options.cwd,
      env: {...process.env, ROOMIE_RUN_TOKEN: options.token},
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  let killed = false;
  let configured = false;
  let stopping = false,
    buffered = '',
    bytes = 0;
  let prompt: string | undefined;
  let onSession: ((id: string) => void) | undefined;
  let sent = false,
    initialized = false;
  let result: {subtype: string; is_error: boolean} | undefined;
  const decoder = new StringDecoder('utf8');
  const pending = new Map<string, z.infer<typeof Permission>>();
  const calls = new Map<
    string,
    {callId: string; name: string; toolClass: string}
  >();
  const denied = new Set<string>();
  const seen = new Set<string>();
  const done = new Promise<void>((resolve) =>
    child.once('close', () => resolve()),
  );
  function kill() {
    if (!child.pid || killed) return;
    try {
      process.kill(-child.pid, 'SIGKILL');
      killed = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  }
  function fail(reason: string) {
    if (stopping) return;
    stopping = true;
    pending.clear();
    kill();
    options.onExit(reason);
  }
  function write(value: unknown) {
    if (stopping || child.stdin.destroyed) throw new Error('Harness stopped.');
    child.stdin.write(JSON.stringify(value) + '\n');
  }
  function sendPrompt() {
    if (!initialized || sent || prompt === undefined) return;
    sent = true;
    write({
      type: 'user',
      uuid: randomUUID(),
      message: {role: 'user', content: '/roomie:roomie\n\n' + prompt},
      parent_tool_use_id: null,
      session_id: '',
    });
  }
  function handle(raw: unknown) {
    const message = Envelope.parse(raw);
    if (message.type === 'control_response') {
      const response = z
        .object({
          request_id: z.string(),
          subtype: z.string(),
          response: z.unknown().optional(),
        })
        .parse(message.response);
      if (response.request_id !== 'initialize' || initialized)
        throw new Error('Unexpected control response.');
      if (response.subtype !== 'success')
        throw new Error('Initialization rejected.');
      const discovery = z
        .object({commands: z.array(z.object({name: z.string()}))})
        .parse(response.response);
      if (
        !discovery.commands.some((command) => command.name === 'roomie:roomie')
      )
        throw new Error('Roomie skill was not discovered.');
      options.onEvent('native.unknown', {
        nativeType: 'skill.available',
        summary: 'Content-addressed Roomie skill discovered as roomie:roomie.',
      });
      initialized = true;
      sendPrompt();
      return;
    }
    if (message.type === 'control_request') {
      if (!configured)
        throw new Error('Permission before configuration verification.');
      const id = z.string().parse(message.request_id);
      const permission = Permission.safeParse(message.request);
      if (
        !permission.success ||
        (!roomieTools.has(permission.data.tool_name) &&
          !(
            permission.data.tool_name === 'Skill' &&
            permission.data.input.skill === 'roomie:roomie'
          ))
      ) {
        write({
          type: 'control_response',
          response: {
            subtype: 'error',
            request_id: id,
            error: 'Unsupported host request; permission not granted.',
          },
        });
        return;
      }
      if (pending.has(id)) throw new Error('Duplicate permission request.');
      pending.set(id, permission.data);
      options.onApproval(
        id,
        permission.data.tool_use_id,
        `Allow ${permission.data.tool_name}?`,
      );
      return;
    }
    if (message.type === 'control_cancel_request') {
      // A cancelled native request cannot later consume a durable owner decision.
      if (pending.has(String(message.request_id)))
        fail('Native approval cancelled; start a new turn.');
      return;
    }
    if (message.type === 'system' && message.subtype === 'init') {
      const init = z
        .object({
          session_id: z.string(),
          claude_code_version: z.literal('2.1.310'),
          mcp_servers: z.array(
            z.object({name: z.string(), status: z.string()}),
          ),
          tools: z.array(z.string()),
        })
        .parse(message);
      if (
        init.mcp_servers.length !== 1 ||
        init.mcp_servers[0]?.name !== 'roomie' ||
        init.mcp_servers[0]?.status !== 'connected' ||
        init.tools.some((name) => name !== 'Skill' && !roomieTools.has(name))
      )
        throw new Error('Unexpected effective Claude tool configuration.');
      if (configured) throw new Error('Duplicate native init.');
      configured = true;
      onSession?.(init.session_id);
      options.onEvent('native.unknown', {
        nativeType: 'system.init',
        summary: 'Claude 2.1.310; only Roomie MCP and Skill tools enabled.',
      });
      return;
    }
    if (message.type === 'assistant' || message.type === 'user') {
      if (!configured)
        throw new Error('Message before configuration verification.');
      const nativeId = z.string().parse(message.uuid);
      if (seen.has(nativeId)) return;
      seen.add(nativeId);
      const content = z
        .object({content: z.array(z.object({type: z.string()}).passthrough())})
        .parse(message.message).content;
      for (const block of content) {
        if (block.type === 'text' && message.type === 'assistant') {
          options.onEvent(
            'message.text',
            {messageId: nativeId, text: z.string().parse(block.text)},
            nativeId,
          );
          options.onEvent(
            'message.completed',
            {messageId: nativeId, status: 'completed'},
            nativeId,
          );
        } else if (block.type === 'tool_use') {
          const id = z.string().parse(block.id),
            name = z.string().parse(block.name);
          const call = {
            callId: id,
            name,
            toolClass:
              name === 'mcp__roomie__execute_command'
                ? 'roomie-command'
                : name.startsWith('mcp__')
                  ? 'mcp'
                  : 'other',
          };
          calls.set(id, call);
          options.onEvent(
            'tool.started',
            {...call, input: block.input ?? {}},
            nativeId,
          );
        } else if (block.type === 'tool_result') {
          const id = z.string().parse(block.tool_use_id);
          const call = calls.get(id);
          if (!call) throw new Error('Tool result without call.');
          let data: unknown;
          try {
            const textBlocks = z
              .array(z.object({type: z.literal('text'), text: z.string()}))
              .safeParse(block.content);
            data = JSON.parse(
              typeof block.content === 'string'
                ? block.content
                : textBlocks.success
                  ? textBlocks.data.map((item) => item.text).join('\n')
                  : JSON.stringify(block.content),
            );
          } catch {
            /* Permission denials are plain text. */
          }
          const receipt = z
            .object({
              data: z.object({
                receipt: z.object({
                  operationId: z.string(),
                  artifactId: z.string(),
                }),
              }),
            })
            .safeParse(data);
          const failed =
            block.is_error === true ||
            z.object({ok: z.literal(false)}).safeParse(data).success;
          options.onEvent(
            'tool.completed',
            {
              ...call,
              status: denied.has(id)
                ? 'denied'
                : failed
                  ? 'failed'
                  : 'completed',
              result: data ?? block.content ?? null,
              ...(receipt.success
                ? {
                    operationId: receipt.data.data.receipt.operationId,
                    artifactRefs: [
                      {artifactId: receipt.data.data.receipt.artifactId},
                    ],
                  }
                : {}),
            },
            nativeId,
          );
          calls.delete(id);
        }
      }
      return;
    }
    if (message.type === 'result') {
      if (!configured || result) throw new Error('Unexpected result.');
      result = z
        .object({subtype: z.string(), is_error: z.boolean()})
        .parse(message);
      const usage = z
        .record(z.string(), z.unknown())
        .parse(message.usage ?? {});
      options.onEvent('usage', {
        usage: Object.fromEntries(
          Object.entries(usage).filter(
            ([, value]) => typeof value === 'number' && Number.isFinite(value),
          ),
        ),
      });
      child.stdin.end();
      return;
    }
    // Completed messages are authoritative; never persist unredacted token fragments.
    if (message.type === 'stream_event') return;
    options.onEvent('native.unknown', {
      nativeType: message.type,
      summary: `Claude ${message.type}`,
    });
  }
  child.stdin.on('error', () => fail('Harness input closed.'));
  child.once('error', () => fail('Could not start Claude Code.'));
  child.once('close', (code) => {
    if (stopping) return;
    stopping = true;
    kill(); // Includes descendants which outlive the leader.
    const success =
      code === 0 &&
      result?.subtype === 'success' &&
      result.is_error === false &&
      pending.size === 0 &&
      calls.size === 0;
    options.onComplete(
      success ? 'succeeded' : 'failed',
      success
        ? 'Native Claude turn completed.'
        : 'Claude exited without a successful complete turn.',
    );
  });
  child.stderr.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 16 * 1024 * 1024) fail('Harness output limit exceeded.');
  });
  child.stdout.on('data', (chunk: Buffer) => {
    try {
      bytes += chunk.length;
      buffered += decoder.write(chunk);
      if (
        bytes > 16 * 1024 * 1024 ||
        Buffer.byteLength(buffered) > 2 * 1024 * 1024
      )
        throw new Error('Output limit.');
      let index;
      while ((index = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, index);
        buffered = buffered.slice(index + 1);
        if (stopping) return;
        if (line.trim()) handle(JSON.parse(line));
      }
    } catch {
      fail('Invalid, unsupported or oversized Claude stream.');
    }
  });
  return {
    done,
    async start(text, callback) {
      prompt = text;
      onSession = callback;
      write({
        type: 'control_request',
        request_id: 'initialize',
        request: {subtype: 'initialize', hooks: {}, agents: {}},
      });
    },
    approve(nativeId, decision) {
      const id = String(nativeId),
        permission = pending.get(id);
      if (!permission) throw new Error('Native approval is stale.');
      pending.delete(id);
      if (decision === 'deny') denied.add(permission.tool_use_id);
      write({
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: id,
          response:
            decision === 'approve'
              ? {
                  behavior: 'allow',
                  updatedInput: permission.input,
                  toolUseID: permission.tool_use_id,
                }
              : {
                  behavior: 'deny',
                  message: 'Denied by the workspace owner. Do not retry.',
                  toolUseID: permission.tool_use_id,
                },
        },
      });
    },
    stop() {
      stopping = true;
      pending.clear();
      kill();
      return done;
    },
  };
}
