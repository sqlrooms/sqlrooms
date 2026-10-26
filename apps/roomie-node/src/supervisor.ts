import type {ExecutionLifecycle} from './lifecycle';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import type {HarnessCapabilities, HarnessStartTurn} from '@sqlrooms/ai-config';
import type {openWorkspace} from './workspace';
import {startCodexHarness} from './codexHarness';
import {startClaude} from './claudeAdapter';
import type {HarnessAdapter} from './harnessAdapter';
import {runError} from './runLog';
import {
  prepareIsolatedHarness,
  type HarnessIsolation,
  type IsolatedHarnessProcess,
} from './harnessIsolation';
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
  lifecycle?: ExecutionLifecycle;
  adapter?: 'codex' | 'claude';
  executable?: string;
  model?: string;
  isolation?: HarnessIsolation;
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
        adapter?: HarnessAdapter;
        boundary?: IsolatedHarnessProcess;
        stopping: boolean;
        release?: () => Promise<void>;
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
        // Startup may be creating a container. Do not publish terminal/admit a
        // new run until that boundary has been removed too.
        await starting;
        await active.adapter?.stop();
        await active.boundary?.dispose();
        await options.drain?.();
        await options.workspace.flush();
        flush();
        // Terminal publication is also the admission boundary for a queued turn.
        current = undefined;
        log.finish(active.id, status, reason);
        await active.release?.();
      } catch {
        closed = true;
        current = undefined;
      }
    })();
  }
  return {
    start(input: HarnessStartTurn, principalId: string) {
      if (closed) throw runError('supervisor_closed', 503);
      if (current?.stopping) throw runError('workspace_run_stopping');
      const result = log.start(
        input,
        principalId,
        {...codexCapabilities, usage: options.adapter === 'claude'},
        skillHash,
        deadlineMs,
        options.adapter ?? 'codex',
      );
      if (!result.created) return result.run;
      const token = options.credentials.issue();
      log.setSecrets([
        token,
        ...Object.values(options.isolation?.modelEnvironment ?? {}),
      ]);
      const active = {
        id: result.run.runId,
        token,
        timer: setTimeout(
          () => finish('interrupted', 'Hard wall-clock deadline exceeded.'),
          deadlineMs,
        ),
        stopping: false,
        release: undefined as (() => Promise<void>) | undefined,
        adapter: undefined as HarnessAdapter | undefined,
        boundary: undefined as IsolatedHarnessProcess | undefined,
      };
      current = active;
      starting = (async () => {
        active.release = await options.lifecycle?.acquire('run', deadlineMs);
        if (active.stopping) return;
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
        const discovery = join(
          cwd,
          options.adapter === 'claude' ? '.claude' : '.agents',
          'skills',
          'roomie',
        );
        await mkdir(discovery, {recursive: true});
        await writeFile(join(discovery, 'SKILL.md'), skill);
        if (options.adapter === 'claude') {
          const manifest = join(cwd, '.claude', '.claude-plugin');
          await mkdir(manifest, {recursive: true});
          await writeFile(
            join(manifest, 'plugin.json'),
            JSON.stringify({name: 'roomie', version: '1.0.0'}),
          );
        }
        if (active.stopping) return;
        const process = options.isolation
          ? await prepareIsolatedHarness({
              isolation: options.isolation,
              cwd,
              mcpUrl: options.mcpUrl,
              token,
              workspaceDirectory: options.workspace.directory,
              deadlineMs,
            })
          : undefined;
        active.boundary = process;
        if (active.stopping) {
          await process?.dispose();
          return;
        }
        active.adapter = (
          options.adapter === 'claude' ? startClaude : startCodexHarness
        )({
          cwd: process?.cwd ?? cwd,
          mcpUrl: process?.mcpUrl ?? options.mcpUrl,
          process,
          token,
          executable: options.executable,
          model: options.model,
          onEvent: (kind, payload, nativeEventId) => {
            if (current !== active || active.stopping) return;
            if (kind === 'message.text') {
              const id = String(payload.messageId);
              chunks.set(
                id,
                (chunks.get(id) ?? '') + String(payload.text ?? ''),
              );
              if ((chunks.get(id)?.length ?? 0) > 512 * 1024)
                finish('failed', 'Message output limit exceeded.');
            } else {
              if (kind === 'message.completed') flush();
              log.append(active.id, kind, payload, nativeEventId);
            }
          },
          onApproval: (nativeId, callId, summary) => {
            if (current !== active || active.stopping) return;
            const approval = log.requestApproval(active.id, callId, summary);
            replies.set(approval.approvalId, nativeId);
          },
          onComplete: (status, reason) => {
            if (current === active) finish(status, reason);
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
          current.adapter.approve(id, decision);
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
