import {z} from 'zod';
import {ChatSessionSchema} from './schema/ChatSessionSchema';
import {createId} from '@paralleldrive/cuid2';

export const AiSliceConfig = z.object({
  sessions: z.array(ChatSessionSchema),
  currentSessionId: z.string().optional(),
  /** IDs of sessions that are open as tabs */
  openSessionTabs: z.array(z.string()).optional(),
});
export type AiSliceConfig = z.infer<typeof AiSliceConfig>;

export function createDefaultAiConfig(
  props?: Partial<AiSliceConfig>,
): AiSliceConfig {
  const defaultSessionId = createId();
  return {
    sessions: [
      {
        id: defaultSessionId,
        name: 'Untitled',
        modelProvider: 'openai',
        model: 'gpt-4.1',
        createdAt: new Date(),
        uiMessages: [],
        messagesRevision: 0,
        prompt: '',
        isRunning: false,
        lastOpenedAt: Date.now(),
      },
    ],
    currentSessionId: defaultSessionId,
    openSessionTabs: [defaultSessionId],
    ...props,
  };
}
