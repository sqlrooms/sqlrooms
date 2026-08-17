import {z} from 'zod';

/**
 * An association between an AI session and an artifact.
 */
export type ArtifactSessionLink = {
  sessionId: string;
  artifactId: string;
  /** Unix timestamp in milliseconds when the association was established. */
  linkedAt: number;
};

/** Zod schema for persisted session-to-artifact associations. */
export const ArtifactSessionLinkSchema = z
  .object({
    sessionId: z.string(),
    artifactId: z.string(),
    linkedAt: z.number(),
  })
  .strict();
