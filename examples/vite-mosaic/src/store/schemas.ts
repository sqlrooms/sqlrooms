import {MAIN_VIEW} from '@sqlrooms/project-config';
import {z} from 'zod';

export const ProjectPanelTypes = z.enum([
  'project-details',
  'data-sources',
  'data-tables',
  'docs',
  MAIN_VIEW,
] as const);

export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;
