import {z} from 'zod';
import {AnalysisSessionSchema} from './schema/AnalysisSessionSchema';
import {createId} from '@paralleldrive/cuid2';

export const AiSliceConfig = z.object({
  sessions: z.array(AnalysisSessionSchema),
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
        name: 'Default Session',
        modelProvider: 'openai',
        model: 'gpt-4.1',
        analysisResults: [],
        createdAt: new Date(),
        uiMessages: [],
        toolAdditionalData: {},
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
