import {z} from 'zod';
import {JsonObjectSchema, JsonValueSchema} from './json';
import {OracleResultSchema} from './oracle';
import {ScenarioIdSchema} from './scenario';

/** Current version of the durable run-evidence envelope. */
export const RUN_EVIDENCE_SCHEMA_VERSION = 1 as const;

/** Ordered event captured while a behavioral scenario runs. */
export const RunEvidenceEventSchema = z
  .looseObject({
    sequence: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
    type: z.enum([
      'model',
      'tool',
      'nested-agent',
      'approval',
      'error',
      'mutation',
    ]),
    name: z.string().min(1).optional(),
    data: JsonObjectSchema.default(() => ({})),
  })
  .catchall(JsonValueSchema);

/** Versioned evidence persisted for one behavioral scenario run. */
export const RunEvidenceSchema = z
  .looseObject({
    schemaVersion: z.literal(RUN_EVIDENCE_SCHEMA_VERSION),
    runId: z.string().min(1),
    scenario: z
      .looseObject({
        id: ScenarioIdSchema,
        version: z.number().int().positive(),
        repetition: z.number().int().nonnegative(),
      })
      .catchall(JsonValueSchema),
    target: z
      .looseObject({
        type: z.string().min(1),
        profileName: z.string().min(1),
        profileVersion: z.number().int().positive(),
      })
      .catchall(JsonValueSchema),
    repository: z
      .looseObject({
        commitSha: z.string().min(1),
        dirty: z.boolean(),
        workflowUrl: z.string().url().optional(),
      })
      .catchall(JsonValueSchema)
      .optional(),
    model: z
      .looseObject({
        provider: z.string().min(1),
        modelId: z.string().min(1),
        configuredRevision: z.string().min(1).optional(),
        upstreamProvider: z.string().min(1).optional(),
        settings: JsonObjectSchema.default(() => ({})),
      })
      .catchall(JsonValueSchema),
    timing: z
      .looseObject({
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime(),
        latencyMs: z.number().nonnegative(),
      })
      .catchall(JsonValueSchema),
    status: z.enum(['passed', 'failed', 'error', 'cancelled']),
    promptTurns: z.array(
      z
        .looseObject({
          id: z.string().min(1),
          input: z.string(),
        })
        .catchall(JsonValueSchema),
    ),
    finalAnswer: z.string(),
    events: z.array(RunEvidenceEventSchema).superRefine((events, context) => {
      for (let index = 1; index < events.length; index += 1) {
        if (events[index]!.sequence <= events[index - 1]!.sequence) {
          context.addIssue({
            code: 'custom',
            message: 'Event sequence values must be strictly increasing.',
            path: [index, 'sequence'],
          });
        }
      }
    }),
    usage: z
      .looseObject({
        inputTokens: z.number().nonnegative().optional(),
        outputTokens: z.number().nonnegative().optional(),
        totalTokens: z.number().nonnegative().optional(),
        costUsd: z.number().nonnegative().optional(),
        grader: JsonObjectSchema.optional(),
      })
      .catchall(JsonValueSchema)
      .optional(),
    finalState: JsonValueSchema.optional(),
    oracleResults: z.array(OracleResultSchema),
    metadata: JsonObjectSchema.default(() => ({})),
  })
  .catchall(JsonValueSchema);

/** Parsed run-evidence envelope. */
export type RunEvidence = z.infer<typeof RunEvidenceSchema>;

/** Parses an object or serialized JSON run-evidence envelope. */
export function parseRunEvidence(input: unknown): RunEvidence {
  return RunEvidenceSchema.parse(
    typeof input === 'string' ? JSON.parse(input) : input,
  );
}

/** Serializes validated run evidence for storage in runner metadata. */
export function serializeRunEvidence(evidence: RunEvidence): string {
  return JSON.stringify(RunEvidenceSchema.parse(evidence));
}
