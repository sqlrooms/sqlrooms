import {z} from 'zod';

/** V1 host-owned run states. A completed model turn is not itself run success. */
export const HarnessRunStatus = z.enum([
  'queued',
  'running',
  'awaiting-input',
  'awaiting-approval',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
]);
/** Adapter capabilities, reported rather than inferred by clients. */
export const HarnessCapabilities = z.object({
  liveInput: z.boolean(),
  continueSession: z.boolean(),
  approvalRecovery: z.boolean(),
  cancelTurn: z.boolean(),
  reasoningSummary: z.boolean(),
  planUpdates: z.boolean(),
  usage: z.boolean(),
});
const id = z.string().min(1);
const payloadSchemas: Record<string, z.ZodType> = {
  'run.status': z.object({
    status: HarnessRunStatus,
    reason: z.string().optional(),
  }),
  'turn.started': z.object({origin: z.enum(['user', 'continuation'])}),
  'turn.completed': z.object({outcome: HarnessRunStatus}),
  'message.user': z.object({
    text: z.string(),
    attachments: z.array(z.string()),
  }),
  'message.text': z.object({messageId: id, text: z.string()}),
  'message.completed': z.object({messageId: id, status: z.string()}),
  'tool.started': z.object({
    callId: id,
    toolClass: z.enum([
      'roomie-command',
      'shell',
      'file-change',
      'mcp',
      'other',
    ]),
    name: z.string(),
  }),
  'tool.output': z.object({
    callId: id,
    stream: z.enum(['stdout', 'stderr', 'log']),
    chunk: z.string(),
  }),
  'tool.completed': z.object({callId: id, status: z.string()}),
  'approval.requested': z.object({
    approvalId: id,
    callId: id,
    summary: z.string(),
    options: z.array(z.enum(['approve', 'deny'])),
  }),
  'approval.resolved': z.object({
    approvalId: id,
    decision: z.enum(['approve', 'deny']),
    resolvedBy: id,
  }),
  'reasoning.summary': z.object({text: z.string()}),
  'plan.updated': z.object({items: z.array(z.json())}),
  usage: z.object({usage: z.record(z.string(), z.json())}),
  'native.unknown': z.object({nativeType: z.string(), summary: z.string()}),
};
/** Durable event envelope. Unknown kinds are intentionally accepted for forward compatibility. */
export const HarnessRunEvent = z
  .object({
    schemaVersion: z.literal(1),
    seq: z.number().int().positive(),
    eventId: z.string().min(1),
    conversationId: z.string().min(1),
    runId: z.string().min(1),
    turnId: z.string().optional(),
    nativeEventId: z.string().optional(),
    at: z.string().datetime(),
    principalId: z.string().min(1),
    kind: z.string().min(1),
    payload: z.record(z.string(), z.json()),
    blobRef: z.string().optional(),
  })
  .superRefine((event, context) => {
    const schema = payloadSchemas[event.kind];
    if (schema && !schema.safeParse(event.payload).success)
      context.addIssue({
        code: 'custom',
        path: ['payload'],
        message: 'Invalid payload for ' + event.kind,
      });
  });
/** A committed replay event; seq is workspace-wide, not per conversation. */
export type HarnessRunEvent = z.infer<typeof HarnessRunEvent>;
/** Adapter capability values. */
export type HarnessCapabilities = z.infer<typeof HarnessCapabilities>;
/** Persisted run status. */
export type HarnessRunStatus = z.infer<typeof HarnessRunStatus>;
/** A new turn; retries must use identical input and the same idempotency key. */
export const HarnessStartTurn = z.strictObject({
  idempotencyKey: z.string().min(1).max(200),
  conversationId: z.string().min(1).optional(),
  text: z.string().min(1).max(32768),
  attachments: z.array(z.string()).max(0).default([]),
});
/** Turn request independent of a harness's native protocol. */
export type HarnessStartTurn = z.input<typeof HarnessStartTurn>;
/** Explicit owner decision; the first decision wins. */
export const HarnessApprovalDecision = z.strictObject({
  approvalId: z.string().min(1),
  decision: z.enum(['approve', 'deny']),
});
/** An approval belongs to one live run, never to a replayed native RPC identifier. */
export const HarnessApproval = z.object({
  approvalId: z.string(),
  runId: z.string(),
  callId: z.string(),
  summary: z.string(),
  options: z.array(z.enum(['approve', 'deny'])),
  decision: z.enum(['approve', 'deny']).nullable(),
  resolvedBy: z.string().nullable(),
});
/** Durable run identity and current state. */
export const HarnessRun = z.object({
  runId: z.string(),
  conversationId: z.string(),
  turnId: z.string(),
  principalId: z.string(),
  status: HarnessRunStatus,
  capabilities: HarnessCapabilities,
  nativeSessionId: z.string().nullable(),
  deadlineAt: z.string().datetime(),
  skillHash: z.string(),
});
/** Consistent conversation snapshot followed by subscription after lastSeq. */
export const HarnessConversationSnapshot = z.object({
  historyHasMore: z.boolean().default(false),
  historyAfterSeq: z.number().int().nonnegative().default(0),
  conversationId: z.string(),
  lastSeq: z.number().int().nonnegative(),
  events: z.array(HarnessRunEvent),
  runs: z.array(HarnessRun),
  pendingApprovals: z.array(HarnessApproval),
});
/** Public replay snapshot. */
export type HarnessConversationSnapshot = z.infer<
  typeof HarnessConversationSnapshot
>;
/** Public run identity. */
export type HarnessRun = z.infer<typeof HarnessRun>;
/** Public pending approval. */
export type HarnessApproval = z.infer<typeof HarnessApproval>;
