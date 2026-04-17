import {createId} from '@paralleldrive/cuid2';
import {DbSliceState} from '@sqlrooms/db';
import {type DuckDbSliceState} from '@sqlrooms/duckdb';
import {LayoutSliceState} from '@sqlrooms/layout';
import type {LayoutMosaicSubNode} from '@sqlrooms/layout-config';
import {LayoutMosaicSubNode as LayoutMosaicSubNodeSchema} from '@sqlrooms/layout-config';
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
  layout: LayoutMosaicSubNodeSchema.nullable().default(null),
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
    setLayout: (
      dashboardId: string,
      layout: LayoutMosaicSubNode | null,
    ) => void;
  };
};

export type MosaicDashboardStoreState = BaseRoomStoreState &
  DbSliceState &
  DuckDbSliceState &
  LayoutSliceState &
  MosaicSliceState &
  MosaicDashboardSliceState;

function appendPanelToLayout(
  layout: LayoutMosaicSubNode | null,
  panelId: string,
): LayoutMosaicSubNode {
  if (!layout) {
    return panelId;
  }
  return {
    type: 'split',
    direction: 'row',
    children: [layout, panelId],
  };
}

function removePanelFromLayout(
  layout: LayoutMosaicSubNode | null,
  panelId: string,
): LayoutMosaicSubNode | null {
  if (!layout) return null;
  if (typeof layout === 'string') {
    return layout === panelId ? null : layout;
  }

  const nextChildren = layout.children
    .map((child: LayoutMosaicSubNode) => removePanelFromLayout(child, panelId))
    .filter((child): child is LayoutMosaicSubNode => child !== null);

  if (nextChildren.length === 0) return null;
  if (nextChildren.length === 1) {
    const onlyChild = nextChildren[0];
    return onlyChild ?? null;
  }

  return {
    ...layout,
    children: nextChildren,
  };
}

function collectPanelIds(
  layout: LayoutMosaicSubNode | null,
  panelIds = new Set<string>(),
) {
  if (!layout) return panelIds;
  if (typeof layout === 'string') {
    panelIds.add(layout);
    return panelIds;
  }
  for (const child of layout.children) {
    collectPanelIds(child, panelIds);
  }
  return panelIds;
}

function ensureLayoutContainsPanels(
  layout: LayoutMosaicSubNode | null,
  panelIds: string[],
): LayoutMosaicSubNode | null {
  let nextLayout = layout;
  const existing = collectPanelIds(layout);

  for (const panelId of panelIds) {
    if (!existing.has(panelId)) {
      nextLayout = appendPanelToLayout(nextLayout, panelId);
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

export function getMosaicDashboardMosaicId(dashboardId: string): string {
  return `dashboard:${dashboardId}:mosaic`;
}

export function getMosaicDashboardSelectionName(dashboardId: string): string {
  return `dashboard:${dashboardId}:brush`;
}

export function parseMosaicDashboardChartId(
  dashboardId: string,
  panelId: string,
): string | undefined {
  const prefix = `dashboard:${dashboardId}:chart:`;
  return panelId.startsWith(prefix) ? panelId.slice(prefix.length) : undefined;
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
                getMosaicDashboardPanelId(dashboardId, chart.id),
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
                (chart) => chart.id !== chartId,
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

              const chartPanelIds = dashboard.charts.map((chart) =>
                getMosaicDashboardPanelId(dashboardId, chart.id),
              );

              dashboard.layout = ensureLayoutContainsPanels(
                layout,
                chartPanelIds,
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
