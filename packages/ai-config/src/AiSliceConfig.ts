import {z} from 'zod';
import {ChatSessionSchema} from './schema/ChatSessionSchema';

export const AiSessionForkOrigin = z.object({
  sourceSessionId: z.string(),
  sourceMessageId: z.string().optional(),
  sourceTurnId: z.string().optional(),
  sourceMessageIndex: z.number().int().nonnegative().optional(),
  legacySourceAnalysisResultId: z.string().optional(),
  sourceSessionNameAtFork: z.string(),
  createdAt: z.number(),
});
export type AiSessionForkOrigin = z.infer<typeof AiSessionForkOrigin>;

export const AiSliceConfig = z.object({
  sessions: z.array(ChatSessionSchema),
  currentSessionId: z.string().optional(),
  /** IDs of sessions that are open as tabs */
  openSessionTabs: z.array(z.string()).optional(),
  /** targetSessionId -> fork provenance */
  sessionForks: z.record(z.string(), AiSessionForkOrigin).default({}),
  /** IDs of pinned sessions */
  pinnedSessionIds: z.array(z.string()).optional(),
});
export type AiSliceConfig = z.infer<typeof AiSliceConfig>;

/**
 * Creates the default AI slice configuration.
 *
 * The default config intentionally contains no chat session: the first session
 * is created lazily when the user sends their first message, so an empty
 * workspace does not show a stray session. `currentSessionId` is therefore
 * `undefined` and all session collections start empty.
 *
 * @param props - Optional overrides merged on top of the generated defaults.
 * Any provided field replaces the corresponding default.
 * @returns A fully-populated {@link AiSliceConfig}.
 */
export function createDefaultAiConfig(
  props?: Partial<AiSliceConfig>,
): AiSliceConfig {
  // Don't create default session - let it be created when user sends first message
  return {
    sessions: [],
    currentSessionId: undefined,
    openSessionTabs: [],
    sessionForks: {},
    pinnedSessionIds: [],
    ...props,
  };
}
