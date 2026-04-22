import {createId} from '@paralleldrive/cuid2';
import {DbSliceState} from '@sqlrooms/db';
import {type DuckDbSliceState} from '@sqlrooms/duckdb';
import {LayoutSliceState} from '@sqlrooms/layout';
import {
  type LayoutNode,
  type LayoutPanelNode,
  LayoutNode as LayoutNodeSchema,
  isLayoutSplitNode,
  isLayoutPanelNode,
  isLayoutNodeKey,
} from '@sqlrooms/layout-config';
import {
  BaseRoomStoreState,
  createSlice,
  SliceFunctions,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import type {Spec} from '@uwdata/mosaic-spec';
import {produce} from 'immer';
import {z} from 'zod';
import {type MosaicSliceState} from '../MosaicSlice';

/**
 * Panel key used for function-form panel definitions registered by
 * `MosaicDashboardCharts`. Individual chart panels are represented as
 * `LayoutPanelNode` entries whose `panel` property carries
 * `{ key: MOSAIC_DASHBOARD_CHART_PANEL, meta: { dashboardId, chartId } }`.
 */
export const MOSAIC_DASHBOARD_CHART_PANEL = 'mosaic-dashboard-chart';

export const MosaicDashboardChartConfig = z.object({
  id: z.string(),
  title: z.string().default('Chart'),
  // TODO: Add a more specific schema for vgplot
  vgplot: z.looseObject({}), // Allow any JSON object
});
export type MosaicDashboardChartConfig = z.infer<
  typeof MosaicDashboardChartConfig
>;

export function createMosaicDashboardChartConfig(
  spec: Spec | Record<string, unknown>,
  title: string,
): MosaicDashboardChartConfig {
  return {
    id: createId(),
    title,
    vgplot: JSON.parse(
      JSON.stringify(spec),
    ) as MosaicDashboardChartConfig['vgplot'],
  };
}

export const MosaicDashboardEntry = z.object({
  id: z.string(),
  title: z.string().default('Dashboard'),
  selectedTable: z.string().optional(),
  charts: z.array(MosaicDashboardChartConfig).default([]),
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
    createDashboard: (title?: string) => string;
    ensureDashboard: (dashboardId: string, title?: string) => void;
    removeDashboard: (dashboardId: string) => void;
    getDashboard: (dashboardId: string) => MosaicDashboardEntry | undefined;
    setSelectedTable: (dashboardId: string, tableName: string) => void;
    addChart: (
      dashboardId: string,
      chart: MosaicDashboardChartConfig,
    ) => MosaicDashboardChartConfig['id'];
    updateChart: (
      dashboardId: string,
      chartId: string,
      patch: Partial<Pick<MosaicDashboardChartConfig, 'title' | 'vgplot'>>,
    ) => void;
    removeChart: (dashboardId: string, chartId: string) => void;
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

function createChartPanelNode(
  dashboardId: string,
  chartId: string,
): LayoutPanelNode {
  return {
    type: 'panel',
    id: getMosaicDashboardPanelId(dashboardId, chartId),
    minSize: 200,
    panel: {
      key: MOSAIC_DASHBOARD_CHART_PANEL,
      meta: {dashboardId, chartId},
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

function ensureLayoutContainsPanels(
  layout: LayoutNode | null,
  dashboardId: string,
  chartIds: string[],
): LayoutNode | null {
  let nextLayout = layout;
  const existing = collectPanelIds(layout);

  for (const chartId of chartIds) {
    const panelId = getMosaicDashboardPanelId(dashboardId, chartId);
    if (!existing.has(panelId)) {
      nextLayout = appendPanelToLayout(
        nextLayout,
        createChartPanelNode(dashboardId, chartId),
      );
      existing.add(panelId);
    }
  }

  return nextLayout;
}

export function getMosaicDashboardPanelId(
  dashboardId: string,
  chartId: string,
): string {
  return `dashboard:${dashboardId}:chart:${chartId}`;
}

export function getMosaicDashboardDockId(dashboardId: string): string {
  return `dashboard:${dashboardId}:dock`;
}

export function getMosaicDashboardSelectionName(dashboardId: string): string {
  return `dashboard:${dashboardId}:brush`;
}

export function createDefaultMosaicDashboardConfig(
  props?: Partial<MosaicDashboardSliceConfig>,
): MosaicDashboardSliceConfig {
  return MosaicDashboardSliceConfig.parse({
    dashboardsById: {},
    ...props,
  });
}

export function createMosaicDashboardSlice(
  props: {config?: Partial<MosaicDashboardSliceConfig>} = {},
) {
  return createSlice<MosaicDashboardSliceState, MosaicDashboardStoreState>(
    (set, get) => ({
      mosaicDashboard: {
        config: createDefaultMosaicDashboardConfig(props.config),

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
                charts: [],
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

        addChart(dashboardId, chart) {
          get().mosaicDashboard.ensureDashboard(dashboardId);
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;

              dashboard.charts.push(chart);
              dashboard.layout = appendPanelToLayout(
                dashboard.layout,
                createChartPanelNode(dashboardId, chart.id),
              );
              dashboard.updatedAt = Date.now();
            }),
          );
          return chart.id;
        },

        updateChart(dashboardId, chartId, patch) {
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;

              const chart = dashboard.charts.find(
                (item) => item.id === chartId,
              );
              if (!chart) return;

              Object.assign(chart, patch);
              dashboard.updatedAt = Date.now();
            }),
          );
        },

        removeChart(dashboardId, chartId) {
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;

              dashboard.charts = dashboard.charts.filter(
                (c) => c.id !== chartId,
              );
              dashboard.layout = removePanelFromLayout(
                dashboard.layout,
                getMosaicDashboardPanelId(dashboardId, chartId),
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

              const chartIds = dashboard.charts.map((chart) => chart.id);
              dashboard.layout = ensureLayoutContainsPanels(
                layout,
                dashboardId,
                chartIds,
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
