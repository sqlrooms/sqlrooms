import {BaseProjectConfig, MAIN_VIEW} from '@sqlrooms/project-config';
import {z} from 'zod';
import {AnalysisResultSchema} from './ai/schemas';

export const ProjectPanelTypes = z.enum([
  'project-details',
  'data-sources',
  'view-configuration',
  MAIN_VIEW,
] as const);

export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

/**
 * Project config for saving
 */
export const DemoProjectConfig = BaseProjectConfig.extend({
  aiModel: z.string().default('o3-mini'),
  analysisResults: z.array(AnalysisResultSchema),
});
export type DemoProjectConfig = z.infer<typeof DemoProjectConfig>;
