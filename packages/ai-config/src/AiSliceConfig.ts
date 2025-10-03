import {z} from 'zod';
import {AnalysisSessionSchema} from './AnalysisSessionSchema';
import {createId} from '@paralleldrive/cuid2';

export const AiSliceConfig = z.object({
  sessions: z.array(AnalysisSessionSchema),
  currentSessionId: z.string().optional(),
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
      },
    ],
    currentSessionId: defaultSessionId,
    ...props,
  };
}
