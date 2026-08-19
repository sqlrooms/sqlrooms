import {z} from 'zod';
import {JsonObjectSchema, JsonValueSchema} from './json';
import {OracleResultSchema} from './oracle';
import {ScenarioIdSchema} from './scenario';

/** Current version of the durable run-evidence envelope. */
export const RUN_EVIDENCE_SCHEMA_VERSION = 1 as const;

/** Ordered event captured while a behavioral scenario runs. */
export const RunEvidenceEventSchema = z.looseObject({
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
  data: JsonObjectSchema.default({}),
});

/** Versioned evidence persisted for one behavioral scenario run. */
export const RunEvidenceSchema = z.looseObject({
  schemaVersion: z.literal(RUN_EVIDENCE_SCHEMA_VERSION),
  runId: z.string().min(1),
  scenario: z.object({
    id: ScenarioIdSchema,
    version: z.number().int().positive(),
    repetition: z.number().int().nonnegative(),
  }),
  target: z.object({
    type: z.string().min(1),
    profileName: z.string().min(1),
    profileVersion: z.number().int().positive(),
  }),
  repository: z
    .object({
      commitSha: z.string().min(1),
      dirty: z.boolean(),
      workflowUrl: z.string().url().optional(),
    })
    .optional(),
  model: z.object({
    provider: z.string().min(1),
    modelId: z.string().min(1),
    configuredRevision: z.string().min(1).optional(),
    upstreamProvider: z.string().min(1).optional(),
    settings: JsonObjectSchema.default({}),
  }),
  timing: z.object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    latencyMs: z.number().nonnegative(),
  }),
  status: z.enum(['passed', 'failed', 'error', 'cancelled']),
  promptTurns: z.array(
    z.object({
      id: z.string().min(1),
      input: z.string(),
    }),
  ),
  finalAnswer: z.string(),
  events: z.array(RunEvidenceEventSchema),
  usage: z
    .object({
      inputTokens: z.number().nonnegative().optional(),
      outputTokens: z.number().nonnegative().optional(),
      totalTokens: z.number().nonnegative().optional(),
      costUsd: z.number().nonnegative().optional(),
      grader: JsonObjectSchema.optional(),
    })
    .optional(),
  finalState: JsonValueSchema.optional(),
  oracleResults: z.array(OracleResultSchema),
  metadata: JsonObjectSchema.default({}),
});

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
