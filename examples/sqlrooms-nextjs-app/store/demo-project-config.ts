import {BaseProjectConfig} from '@sqlrooms/project-config';
import {z} from 'zod';
import {AnalysisResultSchema} from './ai/schemas';

/**
 * Project config for saving
 */
export const DemoProjectConfig = BaseProjectConfig.extend({
  analysisResults: z.array(AnalysisResultSchema),
});
export type DemoProjectConfig = z.infer<typeof DemoProjectConfig>;
