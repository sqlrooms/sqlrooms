/**
 * Core dashboard types - separated to avoid circular dependencies.
 */

import type {ComponentType} from 'react';
import type {DataTable} from '@sqlrooms/db';
import type {ChartTypeDefinition} from '../chart-types/base-types';
import {LayoutNode as LayoutNodeSchema} from '@sqlrooms/layout-config';
import {z} from 'zod';
import {ChartConfig} from '../chart-types/chart-config';

export const MOSAIC_DASHBOARD_CHART_PANEL_TYPE = 'vgplot';
export const MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE = 'profiler';
export const MOSAIC_DASHBOARD_TEXT_PANEL_TYPE = 'text';

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

// Profiler panel config
export const ProfilerPanelConfig = z.object({
  pageSize: z.number().optional(),
});
export type ProfilerPanelConfig = z.infer<typeof ProfilerPanelConfig>;

// Text panel config
export const TextPanelConfig = z.object({
  content: z.string().default(''),
  toolbarOpen: z.boolean().default(true),
  sourcePanelOpen: z.boolean().default(false),
});
export type TextPanelConfig = z.infer<typeof TextPanelConfig>;

// Panel configs discriminated by type
export const ChartPanelConfig = z.object({
  id: z.string(),
  type: z.literal(MOSAIC_DASHBOARD_CHART_PANEL_TYPE),
  title: z.string().default('Panel'),
  source: MosaicDashboardPanelSource.optional(),
  config: ChartConfig,
});
export type ChartPanelConfig = z.infer<typeof ChartPanelConfig>;

export const ProfilerPanel = z.object({
  id: z.string(),
  type: z.literal(MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE),
  title: z.string().default('Panel'),
  source: MosaicDashboardPanelSource.optional(),
  config: ProfilerPanelConfig,
});
export type ProfilerPanel = z.infer<typeof ProfilerPanel>;

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
  .discriminatedUnion('type', [ChartPanelConfig, ProfilerPanel, TextPanel])
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

export type MosaicDashboardAddPanelActionContext = {
  dashboardId: string;
  dashboard: MosaicDashboardEntry | undefined;
  selectedTable: DataTable | undefined;
  tables: DataTable[];
  chartTypes: ChartTypeDefinition[] | undefined;
};

export type MosaicDashboardAddPanelAction = {
  type: string;
  label: string;
  icon?: ComponentType<{className?: string}>;
  isEnabled?: (context: MosaicDashboardAddPanelActionContext) => boolean;
  createPanel: (
    context: MosaicDashboardAddPanelActionContext,
  ) => MosaicDashboardPanelConfig | undefined;
};

export type OnStartDashboard = (prompt: string) => void | Promise<void>;
