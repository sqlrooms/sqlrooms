/**
 * Core dashboard types - separated to avoid circular dependencies.
 */

import {LayoutNode as LayoutNodeSchema} from '@sqlrooms/layout-config';
import {z} from 'zod';
import {ChartConfig} from '../chart-types/chart-config';
import {
  DataTableExplorerPanelConfig,
  TextPanelConfig,
  MosaicDashboardLayoutType,
  MosaicDashboardPanelSource,
} from './core-types';

export const MOSAIC_DASHBOARD_CHART_PANEL_TYPE = 'vgplot';
export const MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE =
  'data-table-explorer';
export const MOSAIC_DASHBOARD_TEXT_PANEL_TYPE = 'text';

// Panel configs discriminated by type
export const ChartPanelConfig = z.object({
  id: z.string(),
  type: z.literal(MOSAIC_DASHBOARD_CHART_PANEL_TYPE),
  title: z.string().default('Panel'),
  source: MosaicDashboardPanelSource.optional(),
  config: ChartConfig,
});
export type ChartPanelConfig = z.infer<typeof ChartPanelConfig>;

export const DataTableExplorerPanel = z.object({
  id: z.string(),
  type: z.literal(MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE),
  title: z.string().default('Panel'),
  source: MosaicDashboardPanelSource.optional(),
  config: DataTableExplorerPanelConfig,
});
export type DataTableExplorerPanel = z.infer<typeof DataTableExplorerPanel>;

export const TextPanel = z.object({
  id: z.string(),
  type: z.literal(MOSAIC_DASHBOARD_TEXT_PANEL_TYPE),
  title: z.string().default('Text'),
  source: MosaicDashboardPanelSource.optional(),
  config: TextPanelConfig,
});
export type TextPanel = z.infer<typeof TextPanel>;

// Legacy panel for backward compatibility
export const LegacyPanelConfig = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().default('Panel'),
  source: MosaicDashboardPanelSource.optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type LegacyPanelConfig = z.infer<typeof LegacyPanelConfig>;

// Discriminated union of all panel types
export const MosaicDashboardPanelConfig = z
  .discriminatedUnion('type', [
    ChartPanelConfig,
    DataTableExplorerPanel,
    TextPanel,
  ])
  .or(LegacyPanelConfig);
export type MosaicDashboardPanelConfig = z.infer<
  typeof MosaicDashboardPanelConfig
>;

export const MosaicDashboardEntry = z.object({
  id: z.string(),
  title: z.string().default('Dashboard'),
  layoutType: MosaicDashboardLayoutType.default('dock'),
  selectedTable: z.string().optional(),
  panels: z.array(MosaicDashboardPanelConfig).default([]),
  layout: LayoutNodeSchema.nullable().default(null),
  updatedAt: z.number().default(0),
});
export type MosaicDashboardEntry = z.infer<typeof MosaicDashboardEntry>;
