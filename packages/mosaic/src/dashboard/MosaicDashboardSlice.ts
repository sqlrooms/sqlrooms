import {createId} from '@paralleldrive/cuid2';
import {DbSliceState} from '@sqlrooms/db';
import {type DataTable, type DuckDbSliceState} from '@sqlrooms/duckdb';
import {LayoutSliceState} from '@sqlrooms/layout';
import {
  type LayoutNode,
  type LayoutPanelNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  LayoutNode as LayoutNodeSchema,
} from '@sqlrooms/layout-config';
import {
  BaseRoomStoreState,
  createSlice,
  SliceFunctions,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import type {Spec} from '@uwdata/mosaic-spec';
import {produce} from 'immer';
import type {ComponentType} from 'react';
import {z} from 'zod';
import type {
  ChartBuilderTemplate,
  ChartTypeDefinition,
} from '../chart-builders/types';
import {type MosaicSliceState} from '../MosaicSlice';

/**
 * Panel key used for function-form panel definitions registered by
 * `MosaicDashboardPanels`. Individual dashboard panels are represented as
 * `LayoutPanelNode` entries whose `panel` property carries
 * `{ key: MOSAIC_DASHBOARD_PANEL, meta: { dashboardId, panelId } }`.
 */
export const MOSAIC_DASHBOARD_PANEL = 'mosaic-dashboard-panel';
export const MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE = 'vgplot';
export const MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE = 'profiler';

export const MosaicDashboardPanelSource = z.object({
  tableName: z.string().optional(),
  sqlQuery: z.string().optional(),
});
export type MosaicDashboardPanelSource = z.infer<
  typeof MosaicDashboardPanelSource
>;

export const MosaicDashboardPanelConfig = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().default('Panel'),
  source: MosaicDashboardPanelSource.optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type MosaicDashboardPanelConfig = z.infer<
  typeof MosaicDashboardPanelConfig
>;

export type MosaicDashboardPanelRendererProps = {
  dashboardId: string;
  dashboard: MosaicDashboardEntry;
  panel: MosaicDashboardPanelConfig;
  selectionName: string;
  resolvedSource?: MosaicDashboardPanelSource;
};

export type MosaicDashboardPanelRenderer = {
  component: ComponentType<MosaicDashboardPanelRendererProps>;
  headerActions?: ComponentType<MosaicDashboardPanelRendererProps>;
  icon?: ComponentType<{className?: string}>;
};

export type MosaicDashboardAddPanelActionContext = {
  dashboardId: string;
  dashboard: MosaicDashboardEntry | undefined;
  selectedTable: DataTable | undefined;
  tables: DataTable[];
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

export function createMosaicDashboardVgPlotPanelConfig(
  spec: Spec | Record<string, unknown>,
  title: string,
  source?: MosaicDashboardPanelSource,
): MosaicDashboardPanelConfig {
  return {
    id: createId(),
    type: MOSAIC_DASHBOARD_VGPLOT_PANEL_TYPE,
    title,
    source,
    config: {
      vgplot: JSON.parse(JSON.stringify(spec)),
    },
  };
}

export function createMosaicDashboardProfilerPanelConfig(
  options: {
    title?: string;
    source?: MosaicDashboardPanelSource;
    pageSize?: number;
  } = {},
): MosaicDashboardPanelConfig {
  return {
    id: createId(),
    type: MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
    title: options.title ?? 'Profiler',
    source: options.source,
    config: {
      pageSize: options.pageSize ?? 10,
    },
  };
}

export const MosaicDashboardEntry = z.object({
  id: z.string(),
  title: z.string().default('Dashboard'),
  selectedTable: z.string().optional(),
  panels: z.array(MosaicDashboardPanelConfig).default([]),
  layout: LayoutNodeSchema.nullable().default(null),
  updatedAt: z.number().default(0),
});
export type MosaicDashboardEntry = z.infer<typeof MosaicDashboardEntry>;

export const MosaicDashboardSliceConfig = z.object({
  dashboardsById: z.record(z.string(), MosaicDashboardEntry).default({}),
});
export type MosaicDashboardSliceConfig = z.infer<
  typeof MosaicDashboardSliceConfig
>;

export type MosaicDashboardSliceState = {
  mosaicDashboard: SliceFunctions & {
    config: MosaicDashboardSliceConfig;
    chartBuilders?: ChartBuilderTemplate[];
    chartTypes?: ChartTypeDefinition[];
    addPanelActions: MosaicDashboardAddPanelAction[];
    createDashboard: (title?: string) => string;
    ensureDashboard: (dashboardId: string, title?: string) => void;
    removeDashboard: (dashboardId: string) => void;
    getDashboard: (dashboardId: string) => MosaicDashboardEntry | undefined;
    setSelectedTable: (dashboardId: string, tableName: string) => void;
    panelRenderers: Record<string, MosaicDashboardPanelRenderer>;
    registerPanelRenderer: (
      type: string,
      renderer: MosaicDashboardPanelRenderer,
    ) => void;
    unregisterPanelRenderer: (type: string) => void;
    addPanel: (
      dashboardId: string,
      panel: MosaicDashboardPanelConfig,
    ) => MosaicDashboardPanelConfig['id'];
    updatePanel: (
      dashboardId: string,
      panelId: string,
      patch: Partial<Omit<MosaicDashboardPanelConfig, 'id'>>,
    ) => void;
    removePanel: (dashboardId: string, panelId: string) => void;
    setLayout: (dashboardId: string, layout: LayoutNode | null) => void;
  };
};

export type MosaicDashboardStoreState = BaseRoomStoreState &
  DbSliceState &
  DuckDbSliceState &
  LayoutSliceState &
  MosaicSliceState &
  MosaicDashboardSliceState;

// ---------------------------------------------------------------------------
// Layout tree helpers (operate on the new LayoutNode types)
// ---------------------------------------------------------------------------

function createDashboardPanelNode(
  dashboardId: string,
  panelId: string,
): LayoutPanelNode {
  return {
    type: 'panel',
    id: getMosaicDashboardPanelId(dashboardId, panelId),
    minSize: 200,
    panel: {
      key: MOSAIC_DASHBOARD_PANEL,
      meta: {dashboardId, panelId},
    },
  };
}

function appendPanelToLayout(
  layout: LayoutNode | null,
  panelNode: LayoutPanelNode,
): LayoutNode {
  if (!layout) {
    return panelNode;
  }
  return {
    type: 'split',
    id: `split-${createId()}`,
    direction: 'row',
    children: [layout, panelNode],
  };
}

function removePanelFromLayout(
  layout: LayoutNode | null,
  panelId: string,
): LayoutNode | null {
  if (!layout) return null;

  if (isLayoutNodeKey(layout)) {
    return layout === panelId ? null : layout;
  }

  if (isLayoutPanelNode(layout)) {
    return layout.id === panelId ? null : layout;
  }

  if (isLayoutSplitNode(layout)) {
    const nextChildren = layout.children
      .map((child) => removePanelFromLayout(child, panelId))
      .filter((child): child is LayoutNode => child !== null);

    if (nextChildren.length === 0) return null;
    if (nextChildren.length === 1) return nextChildren[0] ?? null;

    return {...layout, children: nextChildren};
  }

  return layout;
}

function collectPanelIds(
  layout: LayoutNode | null,
  panelIds = new Set<string>(),
): Set<string> {
  if (!layout) return panelIds;
  if (isLayoutNodeKey(layout)) {
    panelIds.add(layout);
    return panelIds;
  }
  if (isLayoutPanelNode(layout)) {
    panelIds.add(layout.id);
    return panelIds;
  }
  if (isLayoutSplitNode(layout)) {
    for (const child of layout.children) {
      collectPanelIds(child, panelIds);
    }
  }
  return panelIds;
}

function ensureLayoutContainsDashboardPanels(
  layout: LayoutNode | null,
  dashboardId: string,
  panelIds: string[],
): LayoutNode | null {
  let nextLayout = layout;
  const existing = collectPanelIds(layout);

  for (const panelId of panelIds) {
    const layoutPanelId = getMosaicDashboardPanelId(dashboardId, panelId);
    if (!existing.has(layoutPanelId)) {
      nextLayout = appendPanelToLayout(
        nextLayout,
        createDashboardPanelNode(dashboardId, panelId),
      );
      existing.add(layoutPanelId);
    }
  }

  return nextLayout;
}

export function getMosaicDashboardPanelId(
  dashboardId: string,
  panelId: string,
): string {
  return `dashboard:${dashboardId}:panel:${panelId}`;
}

export function getMosaicDashboardDockId(dashboardId: string): string {
  return `dashboard:${dashboardId}:dock`;
}

export function getMosaicDashboardSelectionName(dashboardId: string): string {
  return `dashboard:${dashboardId}:brush`;
}

export function resolveMosaicDashboardPanelSource(
  dashboard: MosaicDashboardEntry,
  panel: MosaicDashboardPanelConfig,
): MosaicDashboardPanelSource | undefined {
  if (panel.source?.sqlQuery || panel.source?.tableName) {
    return panel.source;
  }
  return dashboard.selectedTable
    ? {tableName: dashboard.selectedTable}
    : undefined;
}

export function createDefaultMosaicDashboardConfig(
  props?: Partial<MosaicDashboardSliceConfig>,
): MosaicDashboardSliceConfig {
  return MosaicDashboardSliceConfig.parse({
    dashboardsById: {},
    ...props,
  });
}

type CreateMosaicDashboardSliceProps = {
  config?: Partial<MosaicDashboardSliceConfig>;
  panelRenderers?: Record<string, MosaicDashboardPanelRenderer>;
  addPanelActions?: MosaicDashboardAddPanelAction[];
  chartTypes?: ChartTypeDefinition[];
  chartBuilders?: ChartBuilderTemplate[];
};
export type {CreateMosaicDashboardSliceProps};

export function createMosaicDashboardSlice(
  props: CreateMosaicDashboardSliceProps = {},
) {
  return createSlice<MosaicDashboardSliceState, MosaicDashboardStoreState>(
    (set, get) => ({
      mosaicDashboard: {
        config: createDefaultMosaicDashboardConfig(props.config),
        chartBuilders: props.chartBuilders,
        chartTypes: props.chartTypes,
        addPanelActions: props.addPanelActions ?? [],
        panelRenderers: props.panelRenderers ?? {},

        createDashboard(title) {
          const dashboardId = createId();
          get().mosaicDashboard.ensureDashboard(dashboardId, title);
          return dashboardId;
        },

        ensureDashboard(dashboardId, title) {
          set((state) =>
            produce(state, (draft) => {
              const existing =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (existing) {
                if (title && existing.title !== title) {
                  existing.title = title;
                  existing.updatedAt = Date.now();
                }
                return;
              }
              draft.mosaicDashboard.config.dashboardsById[dashboardId] = {
                id: dashboardId,
                title: title ?? 'Dashboard',
                selectedTable: undefined,
                panels: [],
                layout: null,
                updatedAt: Date.now(),
              };
            }),
          );
        },

        removeDashboard(dashboardId) {
          set((state) =>
            produce(state, (draft) => {
              delete draft.mosaicDashboard.config.dashboardsById[dashboardId];
            }),
          );
        },

        getDashboard(dashboardId) {
          return get().mosaicDashboard.config.dashboardsById[dashboardId];
        },

        setSelectedTable(dashboardId, tableName) {
          get().mosaicDashboard.ensureDashboard(dashboardId);
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;
              dashboard.selectedTable = tableName;
              dashboard.updatedAt = Date.now();
            }),
          );
        },

        registerPanelRenderer(type, renderer) {
          set((state) =>
            produce(state, (draft) => {
              draft.mosaicDashboard.panelRenderers[type] = renderer;
            }),
          );
        },

        unregisterPanelRenderer(type) {
          set((state) =>
            produce(state, (draft) => {
              delete draft.mosaicDashboard.panelRenderers[type];
            }),
          );
        },

        addPanel(dashboardId, panel) {
          get().mosaicDashboard.ensureDashboard(dashboardId);
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;

              dashboard.panels.push(panel);
              dashboard.layout = appendPanelToLayout(
                dashboard.layout,
                createDashboardPanelNode(dashboardId, panel.id),
              );
              dashboard.updatedAt = Date.now();
            }),
          );
          return panel.id;
        },

        updatePanel(dashboardId, panelId, patch) {
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;

              const panel = dashboard.panels.find(
                (candidate) => candidate.id === panelId,
              );
              if (!panel) return;

              Object.assign(panel, patch);
              dashboard.updatedAt = Date.now();
            }),
          );
        },

        removePanel(dashboardId, panelId) {
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;

              dashboard.panels = dashboard.panels.filter(
                (panel) => panel.id !== panelId,
              );
              dashboard.layout = removePanelFromLayout(
                dashboard.layout,
                getMosaicDashboardPanelId(dashboardId, panelId),
              );
              dashboard.updatedAt = Date.now();
            }),
          );
        },

        setLayout(dashboardId, layout) {
          get().mosaicDashboard.ensureDashboard(dashboardId);
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;

              const panelIds = dashboard.panels.map((panel) => panel.id);
              dashboard.layout = ensureLayoutContainsDashboardPanels(
                layout,
                dashboardId,
                panelIds,
              );
              dashboard.updatedAt = Date.now();
            }),
          );
        },
      },
    }),
  );
}

export function useStoreWithMosaicDashboard<T>(
  selector: (state: MosaicDashboardStoreState) => T,
): T {
  return useBaseRoomStore<BaseRoomStoreState, T>((state) =>
    selector(state as unknown as MosaicDashboardStoreState),
  );
}
