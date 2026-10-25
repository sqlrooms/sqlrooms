import {z} from 'zod';
import {startCodex, type CodexMessage} from './codexAdapter';
import type {HarnessAdapter, HarnessAdapterOptions} from './harnessAdapter';

/** Translate Codex native events into the shared run contract. */
export function startCodexHarness(
  options: HarnessAdapterOptions,
): HarnessAdapter {
  const adapter = startCodex({...options, onMessage});
  function onMessage(message: CodexMessage) {
    const params = message.params ?? {};
    const method = message.method ?? 'unknown';
    if (message.id !== undefined) {
      if (
        method === 'item/commandExecution/requestApproval' ||
        method === 'item/fileChange/requestApproval'
      ) {
        options.onApproval(
          message.id,
          String(params.itemId ?? message.id),
          String(
            params.command ?? params.reason ?? 'Approve harness file changes?',
          ),
        );
      } else adapter.reject(message.id);
      return;
    }
    if (method === 'item/agentMessage/delta') {
      options.onEvent('message.text', {
        messageId: String(params.itemId),
        text: String(params.delta ?? ''),
      });
      return;
    }
    if (method === 'turn/completed') {
      const turn = z
        .object({status: z.string()})
        .passthrough()
        .parse(params.turn);
      options.onComplete(
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
          options.onEvent('message.completed', {
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
      options.onEvent(
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
    options.onEvent('native.unknown', {
      nativeType: method,
      summary: method,
      native: params,
    });
  }
  return {
    start: adapter.start,
    stop: adapter.stop,
    done: adapter.done,
    approve(id, decision) {
      adapter.reply(id, {
        decision: decision === 'approve' ? 'accept' : 'decline',
      });
    },
  };
}
