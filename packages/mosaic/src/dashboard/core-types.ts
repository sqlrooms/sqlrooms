/**
 * Core dashboard data types - no dependencies on chart-types.
 * These types can be safely imported by chart-types without creating circular dependencies.
 */

import {z} from 'zod';

// Profiler panel config
export const ProfilerPanelConfig = z.object({
  pageSize: z.number().optional(),
});
export type ProfilerPanelConfig = z.infer<typeof ProfilerPanelConfig>;

// Text panel config
export const TextPanelConfig = z.object({
  content: z.string().default(''),
  toolbarOpen: z.boolean().default(false),
  sourcePanelOpen: z.boolean().default(false),
});
export type TextPanelConfig = z.infer<typeof TextPanelConfig>;

export const MosaicDashboardLayoutType = z.enum(['dock', 'grid']);
export type MosaicDashboardLayoutType = z.infer<
  typeof MosaicDashboardLayoutType
>;

export const MosaicDashboardPanelSource = z.object({
  tableName: z.string().optional(),
  sqlQuery: z.string().optional(),
});
export type MosaicDashboardPanelSource = z.infer<
  typeof MosaicDashboardPanelSource
>;
