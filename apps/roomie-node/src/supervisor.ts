import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import type {HarnessCapabilities, HarnessStartTurn} from '@sqlrooms/ai-config';
import type {openWorkspace} from './workspace';
import {startCodex, type CodexMessage} from './codexAdapter';
import {runError} from './runLog';
import skill from '../skills/roomie/SKILL.md?raw';

/** Capabilities supported by the initial fresh-turn Codex adapter. */
export const codexCapabilities: HarnessCapabilities = {
  liveInput: false,
  continueSession: false,
  approvalRecovery: false,
  cancelTurn: true,
  reasoningSummary: false,
  planUpdates: false,
  usage: false,
};
/** Host-owned supervisor. Browser connections are never inputs to lifecycle decisions. */
export function createSupervisor(options: {
  workspace: Awaited<ReturnType<typeof openWorkspace>>;
  mcpUrl: string;
  credentials: {issue: () => string; revoke: (token: string) => void};
  drain?: () => Promise<void>;
  deadlineMs?: number;
  executable?: string;
  model?: string;
}) {
  const log = options.workspace.runs;
  const deadlineMs = z
    .number()
    .int()
    .min(100)
    .max(3600000)
    .parse(options.deadlineMs ?? 300000);
  const skillHash = createHash('sha256')
    .update('SKILL.md\0')
    .update(skill)
    .digest('hex');
  let current:
    | {
        id: string;
        token: string;
        timer: ReturnType<typeof setTimeout>;
        adapter?: ReturnType<typeof startCodex>;
        stopping: boolean;
      }
    | undefined;
  let closed = false;
  const replies = new Map<string, number | string>();
  const chunks = new Map<string, string>();
  let starting: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  function flush() {
    if (!current) return;
    for (const [messageId, text] of chunks)
      log.append(current.id, 'message.text', {messageId, text});
    chunks.clear();
  }
  function finish(
    status: 'succeeded' | 'failed' | 'cancelled' | 'interrupted',
    reason: string,
  ) {
    const active = current;
    if (!active || active.stopping) return;
    active.stopping = true;
    clearTimeout(active.timer);
    options.credentials.revoke(active.token);
    replies.clear();
    stopping = (async () => {
      try {
        await active.adapter?.stop();
        await options.drain?.();
        await options.workspace.flush();
        flush();
        // Terminal publication is also the admission boundary for a queued turn.
        current = undefined;
        log.finish(active.id, status, reason);
      } catch {
        closed = true;
        current = undefined;
      }
    })();
  }
  function onMessage(message: CodexMessage) {
    if (!current || current.stopping) return;
    const params = message.params ?? {};
    const method = message.method ?? 'unknown';
    if (message.id !== undefined) {
      if (
        method === 'item/commandExecution/requestApproval' ||
        method === 'item/fileChange/requestApproval'
      ) {
        const approval = log.requestApproval(
          current.id,
          String(params.itemId ?? message.id),
          String(
            params.command ?? params.reason ?? 'Approve harness file changes?',
          ),
        );
        replies.set(approval.approvalId, message.id);
      } else current.adapter?.reject(message.id);
      return;
    }
    if (method === 'item/agentMessage/delta') {
      const id = String(params.itemId);
      chunks.set(id, (chunks.get(id) ?? '') + String(params.delta ?? ''));
      if ((chunks.get(id)?.length ?? 0) > 512 * 1024)
        finish('failed', 'Message output limit exceeded.');
      return;
    }
    if (method === 'turn/completed') {
      flush();
      const turn = z
        .object({status: z.string()})
        .passthrough()
        .parse(params.turn);
      finish(
        turn.status === 'completed'
          ? 'succeeded'
          : turn.status === 'interrupted'
            ? 'interrupted'
            : 'failed',
        `Native turn ${turn.status}.`,
      );
      return;
    }
    if (method === 'item/started' || method === 'item/completed') {
      const item = z
        .object({id: z.string(), type: z.string()})
        .passthrough()
        .parse(params.item);
      if (item.type === 'agentMessage') {
        if (method === 'item/completed') {
          flush();
          log.append(current.id, 'message.completed', {
            messageId: item.id,
            status: 'completed',
          });
        }
        return;
      }
      if (item.type === 'userMessage') return;
      const toolClass =
        item.type === 'mcpToolCall'
          ? item.server === 'roomie'
            ? 'roomie-command'
            : 'mcp'
          : item.type === 'commandExecution'
            ? 'shell'
            : item.type === 'fileChange'
              ? 'file-change'
              : 'other';
      const receipt = z
        .object({
          structuredContent: z.object({
            data: z.object({
              receipt: z.object({
                operationId: z.string(),
                artifactId: z.string(),
              }),
            }),
          }),
        })
        .safeParse(item.result);
      const mcpFailure =
        z.object({isError: z.literal(true)}).safeParse(item.result).success ||
        z
          .object({structuredContent: z.object({ok: z.literal(false)})})
          .safeParse(item.result).success;
      const references = receipt.success
        ? {
            operationId:
              receipt.data.structuredContent.data.receipt.operationId,
            artifactRefs: [
              {
                artifactId:
                  receipt.data.structuredContent.data.receipt.artifactId,
              },
            ],
          }
        : {};
      log.append(
        current.id,
        method === 'item/started' ? 'tool.started' : 'tool.completed',
        {
          ...references,
          callId: item.id,
          toolClass,
          name: item.tool ?? item.command ?? item.type,
          input: item.arguments ?? {},
          status: mcpFailure ? 'failed' : (item.status ?? 'completed'),
          result: item.result ?? item.aggregatedOutput ?? null,
        },
        item.id,
      );
      return;
    }
    // Unsupported delta streams are transient: persisting fragments could bypass secret redaction.
    if (/delta$/i.test(method)) return;
    // Native duplicates are diagnostic only, not another transcript projection.
    if (method.startsWith('codex/event/')) return;
    log.append(current.id, 'native.unknown', {
      nativeType: method,
      summary: method,
      native: params,
    });
  }
  return {
    start(input: HarnessStartTurn, principalId: string) {
      if (closed) throw runError('supervisor_closed', 503);
      if (current?.stopping) throw runError('workspace_run_stopping');
      const result = log.start(
        input,
        principalId,
        codexCapabilities,
        skillHash,
        deadlineMs,
      );
      if (!result.created) return result.run;
      const token = options.credentials.issue();
      log.setSecrets([token]);
      const active = {
        id: result.run.runId,
        token,
        timer: setTimeout(
          () => finish('interrupted', 'Hard wall-clock deadline exceeded.'),
          deadlineMs,
        ),
        stopping: false,
        adapter: undefined as ReturnType<typeof startCodex> | undefined,
      };
      current = active;
      starting = (async () => {
        // Immutable canonical bytes and a separate adapter copy; never expose host data paths.
        const canonical = join(
          options.workspace.directory,
          'skills',
          skillHash,
        );
        const cwd = join(options.workspace.directory, 'sessions', active.id);
        await mkdir(canonical, {recursive: true});
        await writeFile(join(canonical, 'SKILL.md'), skill, {
          flag: 'wx',
          mode: 0o400,
        }).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'EEXIST') throw error;
        });
        const discovery = join(cwd, '.agents', 'skills', 'roomie');
        await mkdir(discovery, {recursive: true});
        await writeFile(join(discovery, 'SKILL.md'), skill);
        if (active.stopping) return;
        active.adapter = startCodex({
          cwd,
          mcpUrl: options.mcpUrl,
          token,
          executable: options.executable,
          model: options.model,
          onMessage: (message) => {
            if (current === active && !active.stopping) onMessage(message);
          },
          onExit: (reason) => {
            if (current === active) finish('failed', reason);
          },
        });
        await active.adapter.start(input.text, (nativeId) => {
          if (current === active && !active.stopping)
            log.started(active.id, nativeId);
        });
      })().catch(() => {
        if (current === active)
          finish('failed', 'Harness startup or protocol failed.');
      });
      return result.run;
    },
    resolve(
      approvalId: string,
      decision: 'approve' | 'deny',
      principalId: string,
    ) {
      const result = log.resolveApproval(approvalId, decision, principalId);
      if (result.changed) {
        const id = replies.get(approvalId);
        replies.delete(approvalId);
        if (id === undefined || !current?.adapter)
          throw runError('approval_stale');
        try {
          current.adapter.reply(id, {
            decision: decision === 'approve' ? 'accept' : 'decline',
          });
        } catch {
          finish('interrupted', 'Approval persisted but native reply failed.');
        }
      }
      return result.approval;
    },
    async cancel(runId: string) {
      const run = log.get(runId);
      if (current?.id === runId) {
        finish('cancelled', 'Cancelled by owner.');
        await stopping;
      }
      return log.get(run.runId);
    },
    async dispose() {
      closed = true;
      const adapter = current?.adapter;
      finish('interrupted', 'Host shutting down.');
      await starting;
      await adapter?.done;
      await stopping;
    },
  };
}
