import {createId} from '@paralleldrive/cuid2';
import {DbSliceState} from '@sqlrooms/db';
import {type DuckDbSliceState} from '@sqlrooms/duckdb';
import {
  DEFAULT_GRID_COLS,
  getGridColsForBreakpoint,
  type LayoutSliceState,
} from '@sqlrooms/layout';
import {
  type LayoutGridItem,
  type LayoutGridNode,
  LayoutNode,
  type LayoutPanelNode,
  isLayoutGridNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
} from '@sqlrooms/layout-config';
import {
  BaseRoomStoreState,
  createSlice,
  SliceFunctions,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import type {ComponentType} from 'react';
import {z} from 'zod';
import type {ChartTypeDefinition} from '../chart-types/base-types';
import {ChartConfig} from '../chart-types/chart-config';
import {type MosaicSliceState} from '../MosaicSlice';
import {
  destroyRetainedVgPlotChart,
  type RetainedVgPlotChart,
} from '../VgPlotChart';
import type {MosaicDashboardAddPanelAction} from './action-types';
import type {ChartRuntimeIssue} from '../chart-runtime';

/**
 * Panel key used for function-form panel definitions registered by
 * `MosaicDashboardPanels`. Individual dashboard panels are represented as
 * `LayoutPanelNode` entries whose `panel` property carries
 * `{ key: MOSAIC_DASHBOARD_PANEL, meta: { dashboardId, panelId } }`.
 */
export const MOSAIC_DASHBOARD_PANEL = 'mosaic-dashboard-panel';
export const MOSAIC_DASHBOARD_CHART_PANEL_TYPE = 'vgplot';
export const MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE = 'profiler';
export const MOSAIC_DASHBOARD_TEXT_PANEL_TYPE = 'text';

export const MosaicDashboardLayoutType = z.enum(['dock', 'grid']);
export type MosaicDashboardLayoutType = z.infer<
  typeof MosaicDashboardLayoutType
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
  config: ChartConfig,
});
export type ChartPanelConfig = z.infer<typeof ChartPanelConfig>;

export const ProfilerPanel = z.object({
  id: z.string(),
  type: z.literal(MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE),
  title: z.string().default('Panel'),
  config: ProfilerPanelConfig,
});
export type ProfilerPanel = z.infer<typeof ProfilerPanel>;

export const TextPanel = z.object({
  id: z.string(),
  type: z.literal(MOSAIC_DASHBOARD_TEXT_PANEL_TYPE),
  title: z.string().default('Text'),
  config: TextPanelConfig,
});
export type TextPanel = z.infer<typeof TextPanel>;

// Legacy panel for backward compatibility
export const LegacyPanelConfig = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().default('Panel'),
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

export type MosaicDashboardPanelRendererProps<
  TPanel extends MosaicDashboardPanelConfig = MosaicDashboardPanelConfig,
> = {
  dashboardId: string;
  dashboard: MosaicDashboardEntry;
  panel: TPanel;
  selectionName: string;
};

export type ChartPanelRendererProps =
  MosaicDashboardPanelRendererProps<ChartPanelConfig>;
export type ProfilerPanelRendererProps =
  MosaicDashboardPanelRendererProps<ProfilerPanel>;
export type TextPanelRendererProps =
  MosaicDashboardPanelRendererProps<TextPanel>;

export type MosaicDashboardPanelRenderer<
  TPanel extends MosaicDashboardPanelConfig = MosaicDashboardPanelConfig,
> = {
  component: ComponentType<MosaicDashboardPanelRendererProps<TPanel>>;
  headerActions?: ComponentType<MosaicDashboardPanelRendererProps<TPanel>>;
  icon?: ComponentType<{className?: string}>;
};

// Type-erased renderer for storage (avoids circular dependency issues)
export type AnyPanelRenderer = {
  component: ComponentType<any>;
  headerActions?: ComponentType<any>;
  icon?: ComponentType<{className?: string}>;
};

// Map of panel type string to panel config type
export type PanelTypeMap = {
  [MOSAIC_DASHBOARD_CHART_PANEL_TYPE]: ChartPanelConfig;
  [MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE]: ProfilerPanel;
  [MOSAIC_DASHBOARD_TEXT_PANEL_TYPE]: TextPanel;
};

// Panel renderers record - use type-erased renderers for runtime compatibility
export type PanelRenderersRecord = Record<string, AnyPanelRenderer>;

export function createMosaicDashboardChartPanelConfig(
  title: string,
  config: ChartConfig,
): ChartPanelConfig {
  return {
    id: createId(),
    type: MOSAIC_DASHBOARD_CHART_PANEL_TYPE,
    title,
    config,
  };
}

export function createMosaicDashboardProfilerPanelConfig(
  options: {
    title?: string;
    config?: ProfilerPanelConfig;
  } = {},
): ProfilerPanel {
  return {
    id: createId(),
    type: MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
    title: options.title ?? 'Profiler',
    config: options.config ?? {},
  };
}

export function createMosaicDashboardTextPanelConfig(
  options: {
    title?: string;
    config?: TextPanelConfig;
  } = {},
): TextPanel {
  return {
    id: createId(),
    type: MOSAIC_DASHBOARD_TEXT_PANEL_TYPE,
    title: options.title ?? 'Text',
    config: options.config ?? {
      toolbarOpen: false,
      sourcePanelOpen: false,
      content: '',
    },
  };
}

export const MosaicDashboardEntry = z.object({
  id: z.string(),
  title: z.string().default('Dashboard'),
  layoutType: MosaicDashboardLayoutType.default('dock'),
  selectedTable: z.string().optional(),
  lastSelectedTable: z.string().optional(),
  panels: z.array(MosaicDashboardPanelConfig).default([]),
  layout: LayoutNode.nullable().default(null),
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
    runtime: {
      /**
       * Live vgplot chart instances retained across transient dashboard panel
       * remounts, keyed by `getMosaicDashboardPanelId(dashboardId, panelId)`.
       *
       * This is runtime-only state: entries are never serialized with dashboard
       * config and must be evicted when their panel/dashboard lifecycle ends.
       */
      retainedChartsByPanelId: Record<string, RetainedVgPlotChart>;
      /**
       * Runtime-only chart issues keyed by `getMosaicDashboardPanelId`.
       * These are live diagnostics for UI and AI tools, not persisted config.
       */
      panelIssuesByPanelId: Record<string, ChartRuntimeIssue>;
    };
    chartTypes?: ChartTypeDefinition[];
    addPanelActions: MosaicDashboardAddPanelAction[];
    createDashboard: (
      title?: string,
      layoutType?: MosaicDashboardLayoutType,
    ) => string;
    ensureDashboard: (
      dashboardId: string,
      title?: string,
      layoutType?: MosaicDashboardLayoutType,
    ) => void;
    removeDashboard: (dashboardId: string) => void;
    getDashboard: (dashboardId: string) => MosaicDashboardEntry | undefined;
    setSelectedTable: (dashboardId: string, tableName: string) => void;
    setLastSelectedTable: (dashboardId: string, tableName: string) => void;
    panelRenderers: PanelRenderersRecord;
    registerPanelRenderer: (type: string, renderer: AnyPanelRenderer) => void;
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
    getRetainedChart: (
      dashboardId: string,
      panelId: string,
    ) => RetainedVgPlotChart | undefined;
    setRetainedChart: (
      dashboardId: string,
      panelId: string,
      chart: RetainedVgPlotChart,
    ) => void;
    getPanelIssue: (
      dashboardId: string,
      panelId: string,
    ) => ChartRuntimeIssue | undefined;
    reportPanelIssue: (
      dashboardId: string,
      panelId: string,
      issue: ChartRuntimeIssue,
    ) => void;
    clearPanelIssue: (dashboardId: string, panelId: string) => void;
    evictPanelRuntime: (dashboardId: string, panelId: string) => void;
    evictDashboardRuntime: (
      dashboardId: string,
      options?: {resetSelection?: boolean},
    ) => void;
    clearAllDashboardRuntime: () => void;
    setLayout: (dashboardId: string, layout: LayoutNode | null) => void;
  };
};

export type MosaicDashboardStoreState = BaseRoomStoreState &
  DbSliceState &
  DuckDbSliceState &
  LayoutSliceState &
  MosaicSliceState &
  MosaicDashboardSliceState;

type DashboardPanelTypesByLayoutId = Record<string, string | undefined>;

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

function getDashboardPanelTypesByLayoutId(
  dashboardId: string,
  panels: MosaicDashboardPanelConfig[],
): DashboardPanelTypesByLayoutId {
  return Object.fromEntries(
    panels.map((panel) => [
      getMosaicDashboardPanelId(dashboardId, panel.id),
      panel.type,
    ]),
  );
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

function createDashboardGridLayout(
  dashboardId: string,
  panelNode?: LayoutPanelNode,
): LayoutGridNode {
  const children = panelNode ? [panelNode] : [];
  const layouts = createDashboardGridLayoutsForChildren(children);
  return {
    type: 'grid',
    id: getMosaicDashboardGridId(dashboardId),
    children,
    rowHeight: 150,
    margin: [12, 12],
    containerPadding: [0, 0],
    compactType: 'vertical',
    preventCollision: false,
    resizeHandles: ['e', 's', 'w', 'se', 'sw'],
    layouts,
  };
}

function getLayoutChildId(node: LayoutNode): string {
  return isLayoutNodeKey(node) ? node : node.id;
}

function createDashboardGridItem(
  panelId: string,
  layout: LayoutGridItem[],
  cols = 12,
  panelType?: string,
): LayoutGridItem {
  const effectiveCols = Math.max(1, cols);
  const w =
    panelType === MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE
      ? effectiveCols
      : Math.max(1, Math.ceil(effectiveCols / 2));
  const h = 2;
  const bottom = layout.reduce(
    (max, item) => Math.max(max, item.y + item.h),
    0,
  );

  for (let y = 0; y <= bottom; y += 1) {
    for (let x = 0; x <= effectiveCols - w; x += 1) {
      const overlaps = layout.some(
        (item) =>
          x < item.x + item.w &&
          x + w > item.x &&
          y < item.y + item.h &&
          y + h > item.y,
      );
      if (!overlaps) {
        return {
          i: panelId,
          x,
          y,
          w,
          h,
        };
      }
    }
  }

  return {
    i: panelId,
    x: 0,
    y: bottom,
    w,
    h,
  };
}

function createDashboardGridLayoutsForChildren(
  children: LayoutNode[],
  sourceLayouts?: LayoutGridNode['layouts'],
  cols?: LayoutGridNode['cols'],
  panelTypesByLayoutId: Record<string, string | undefined> = {},
): LayoutGridNode['layouts'] {
  const childIds = new Set(children.map((child) => getLayoutChildId(child)));
  const sourceEntries = new Map<string, LayoutGridItem[]>(
    Object.keys(DEFAULT_GRID_COLS).map((breakpoint) => [breakpoint, []]),
  );
  for (const [breakpoint, breakpointLayout] of Object.entries(
    sourceLayouts ?? {},
  )) {
    sourceEntries.set(breakpoint, breakpointLayout);
  }

  return Object.fromEntries(
    [...sourceEntries.entries()].map(([breakpoint, breakpointLayout]) => {
      const nextLayout = breakpointLayout.filter((item) =>
        childIds.has(item.i),
      );
      const layoutItemIds = new Set(nextLayout.map((item) => item.i));

      for (const child of children) {
        const childId = getLayoutChildId(child);
        if (!layoutItemIds.has(childId)) {
          const item = createDashboardGridItem(
            childId,
            nextLayout,
            getGridColsForBreakpoint(cols, breakpoint),
            panelTypesByLayoutId[childId],
          );
          nextLayout.push(item);
          layoutItemIds.add(childId);
        }
      }

      return [breakpoint, nextLayout];
    }),
  );
}

function isExpectedDashboardPanelNode(
  node: LayoutNode,
  expectedPanelIds: Set<string>,
): boolean {
  return expectedPanelIds.has(getLayoutChildId(node));
}

function collectDashboardPanelNodes(
  layout: LayoutNode | null,
  expectedPanelIds: Set<string>,
  nodes: LayoutNode[] = [],
  seen = new Set<string>(),
): LayoutNode[] {
  if (!layout) return nodes;

  if (isLayoutNodeKey(layout) || isLayoutPanelNode(layout)) {
    if (isExpectedDashboardPanelNode(layout, expectedPanelIds)) {
      const id = getLayoutChildId(layout);
      if (!seen.has(id)) {
        nodes.push(layout);
        seen.add(id);
      }
    }
    return nodes;
  }

  if (isLayoutSplitNode(layout) || isLayoutGridNode(layout)) {
    for (const child of layout.children) {
      collectDashboardPanelNodes(child, expectedPanelIds, nodes, seen);
    }
  }

  return nodes;
}

function normalizeDashboardGridLayout(
  layout: LayoutNode | null,
  dashboardId: string,
  expectedPanelIds: Set<string>,
  panelTypesByLayoutId: DashboardPanelTypesByLayoutId = {},
): LayoutGridNode {
  const collectedPanelIds = collectPanelIds(layout);
  const existingExpectedPanelIds = new Set(
    [...expectedPanelIds].filter((panelId) => collectedPanelIds.has(panelId)),
  );
  const children = collectDashboardPanelNodes(layout, existingExpectedPanelIds);
  const layouts = createDashboardGridLayoutsForChildren(
    children,
    isLayoutGridNode(layout) ? layout.layouts : undefined,
    isLayoutGridNode(layout) ? layout.cols : undefined,
    panelTypesByLayoutId,
  );

  if (isLayoutGridNode(layout)) {
    return {
      ...layout,
      children,
      layouts,
    };
  }

  return {
    ...createDashboardGridLayout(dashboardId),
    children,
    layouts,
  };
}

function appendPanelToGridLayout(
  layout: LayoutNode | null,
  dashboardId: string,
  panelNode: LayoutPanelNode,
  panelType?: string,
  panelTypesByLayoutId: DashboardPanelTypesByLayoutId = {},
): LayoutGridNode {
  const nextPanelTypesByLayoutId = {
    ...panelTypesByLayoutId,
    [panelNode.id]: panelType ?? panelTypesByLayoutId[panelNode.id],
  };

  if (!isLayoutGridNode(layout)) {
    const dashboardPanelPrefix = `dashboard:${dashboardId}:panel:`;
    const expectedPanelIds = new Set(
      [...collectPanelIds(layout)].filter((panelId) =>
        panelId.startsWith(dashboardPanelPrefix),
      ),
    );
    expectedPanelIds.add(panelNode.id);
    const normalizedLayout = normalizeDashboardGridLayout(
      layout,
      dashboardId,
      expectedPanelIds,
      nextPanelTypesByLayoutId,
    );
    return appendPanelToGridLayout(
      normalizedLayout,
      dashboardId,
      panelNode,
      panelType,
      nextPanelTypesByLayoutId,
    );
  }

  const hasChild = layout.children.some((child) => {
    if (isLayoutNodeKey(child)) return child === panelNode.id;
    return child.id === panelNode.id;
  });
  const children = hasChild ? layout.children : [...layout.children, panelNode];
  const layouts = Object.fromEntries(
    Object.entries(
      createDashboardGridLayoutsForChildren(
        children,
        layout.layouts,
        layout.cols,
        nextPanelTypesByLayoutId,
      ) ?? {},
    ).map(([breakpoint, breakpointLayout]) => {
      if (breakpointLayout.some((item) => item.i === panelNode.id)) {
        return [breakpoint, breakpointLayout];
      }
      return [
        breakpoint,
        [
          ...breakpointLayout,
          createDashboardGridItem(
            panelNode.id,
            breakpointLayout,
            getGridColsForBreakpoint(layout.cols, breakpoint),
            nextPanelTypesByLayoutId[panelNode.id],
          ),
        ],
      ];
    }),
  );

  return {
    ...layout,
    children,
    layouts,
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

  if (isLayoutGridNode(layout)) {
    const nextChildren = layout.children.filter((child) => {
      if (isLayoutNodeKey(child)) return child !== panelId;
      return child.id !== panelId;
    });
    const nextLayouts = layout.layouts
      ? Object.fromEntries(
          Object.entries(layout.layouts).map(
            ([breakpoint, breakpointLayout]) => [
              breakpoint,
              breakpointLayout.filter((item) => item.i !== panelId),
            ],
          ),
        )
      : layout.layouts;

    if (nextChildren.length === 0) return null;
    return {...layout, children: nextChildren, layouts: nextLayouts};
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
  if (isLayoutGridNode(layout)) {
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
  layoutType: MosaicDashboardLayoutType = 'dock',
  panelTypesByLayoutId: DashboardPanelTypesByLayoutId = {},
): LayoutNode | null {
  let nextLayout = layout;

  if (layoutType === 'grid') {
    const expectedPanelIds = new Set(
      panelIds.map((panelId) =>
        getMosaicDashboardPanelId(dashboardId, panelId),
      ),
    );
    nextLayout = normalizeDashboardGridLayout(
      nextLayout,
      dashboardId,
      expectedPanelIds,
      panelTypesByLayoutId,
    );
  }

  const existing = collectPanelIds(nextLayout);
  for (const panelId of panelIds) {
    const layoutPanelId = getMosaicDashboardPanelId(dashboardId, panelId);
    if (!existing.has(layoutPanelId)) {
      const panelNode = createDashboardPanelNode(dashboardId, panelId);
      nextLayout =
        layoutType === 'grid'
          ? appendPanelToGridLayout(
              nextLayout,
              dashboardId,
              panelNode,
              panelTypesByLayoutId[layoutPanelId],
              panelTypesByLayoutId,
            )
          : appendPanelToLayout(nextLayout, panelNode);
      existing.add(layoutPanelId);
    }
  }

  return nextLayout;
}

export function isChartPanelConfig(
  panel: MosaicDashboardPanelConfig,
): panel is ChartPanelConfig {
  return panel.type === MOSAIC_DASHBOARD_CHART_PANEL_TYPE;
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

export function getMosaicDashboardGridId(dashboardId: string): string {
  return `dashboard:${dashboardId}:grid`;
}

export function getMosaicDashboardSelectionName(dashboardId: string): string {
  return `dashboard:${dashboardId}:brush`;
}

function destroyDashboardRuntimeChart(
  chart: RetainedVgPlotChart | undefined,
): void {
  if (!chart) return;
  destroyRetainedVgPlotChart(chart);
}

function evictDashboardSelection(
  state: MosaicDashboardStoreState,
  dashboardId: string,
): void {
  state.mosaic.selections[
    getMosaicDashboardSelectionName(dashboardId)
  ]?.reset();
}

function shouldEvictPanelRuntimeForPatch(
  panel: MosaicDashboardPanelConfig,
  patch: Partial<Omit<MosaicDashboardPanelConfig, 'id'>>,
): boolean {
  if (patch.type && patch.type !== panel.type) {
    return true;
  }

  if (panel.type === MOSAIC_DASHBOARD_CHART_PANEL_TYPE) {
    return Boolean('config' in patch && patch.config);
  }

  return false;
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
};
export type {CreateMosaicDashboardSliceProps};

export function createMosaicDashboardSlice(
  props: CreateMosaicDashboardSliceProps = {},
) {
  return createSlice<MosaicDashboardSliceState, MosaicDashboardStoreState>(
    (set, get) => ({
      mosaicDashboard: {
        config: createDefaultMosaicDashboardConfig(props.config),
        runtime: {
          retainedChartsByPanelId: {},
          panelIssuesByPanelId: {},
        },
        chartTypes: props.chartTypes,
        addPanelActions: props.addPanelActions ?? [],
        panelRenderers: props.panelRenderers ?? {},

        createDashboard(title, layoutType) {
          const dashboardId = createId();
          get().mosaicDashboard.ensureDashboard(dashboardId, title, layoutType);
          return dashboardId;
        },

        ensureDashboard(dashboardId, title, layoutType) {
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
                layoutType: layoutType ?? 'dock',
                selectedTable: undefined,
                panels: [],
                layout:
                  layoutType === 'grid'
                    ? createDashboardGridLayout(dashboardId)
                    : null,
                updatedAt: Date.now(),
              };
            }),
          );
        },

        removeDashboard(dashboardId) {
          get().mosaicDashboard.evictDashboardRuntime(dashboardId, {
            resetSelection: true,
          });
          set((state) =>
            produce(state, (draft) => {
              delete draft.mosaicDashboard.config.dashboardsById[dashboardId];
            }),
          );
        },

        getDashboard(dashboardId) {
          return get().mosaicDashboard.config.dashboardsById[dashboardId];
        },

        setConfig(config: MosaicDashboardSliceConfig) {
          set((state) =>
            produce(state, (draft) => {
              draft.mosaicDashboard.config = config;
            }),
          );
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

        setLastSelectedTable(dashboardId, tableName) {
          get().mosaicDashboard.ensureDashboard(dashboardId);
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;
              dashboard.lastSelectedTable = tableName;
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
              const panelNode = createDashboardPanelNode(dashboardId, panel.id);
              const panelTypesByLayoutId = getDashboardPanelTypesByLayoutId(
                dashboardId,
                dashboard.panels,
              );
              dashboard.layout =
                dashboard.layoutType === 'grid'
                  ? appendPanelToGridLayout(
                      dashboard.layout,
                      dashboardId,
                      panelNode,
                      panel.type,
                      panelTypesByLayoutId,
                    )
                  : appendPanelToLayout(dashboard.layout, panelNode);
              dashboard.updatedAt = Date.now();
            }),
          );
          return panel.id;
        },

        updatePanel(dashboardId, panelId, patch) {
          const existing = get().mosaicDashboard.config.dashboardsById[
            dashboardId
          ]?.panels.find((candidate) => candidate.id === panelId);
          const shouldEvict = existing
            ? shouldEvictPanelRuntimeForPatch(existing, patch)
            : false;
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
          if (shouldEvict) {
            get().mosaicDashboard.evictPanelRuntime(dashboardId, panelId);
          }
        },

        removePanel(dashboardId, panelId) {
          get().mosaicDashboard.evictPanelRuntime(dashboardId, panelId);
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

        getRetainedChart(dashboardId, panelId) {
          return get().mosaicDashboard.runtime.retainedChartsByPanelId[
            getMosaicDashboardPanelId(dashboardId, panelId)
          ];
        },

        setRetainedChart(dashboardId, panelId, chart) {
          const runtimePanelId = getMosaicDashboardPanelId(
            dashboardId,
            panelId,
          );
          const previous =
            get().mosaicDashboard.runtime.retainedChartsByPanelId[
              runtimePanelId
            ];
          if (previous && previous !== chart) {
            destroyDashboardRuntimeChart(previous);
          }
          set((state) => ({
            mosaicDashboard: {
              ...state.mosaicDashboard,
              runtime: {
                ...state.mosaicDashboard.runtime,
                retainedChartsByPanelId: {
                  ...state.mosaicDashboard.runtime.retainedChartsByPanelId,
                  [runtimePanelId]: chart,
                },
              },
            },
          }));
        },

        getPanelIssue(dashboardId, panelId) {
          return get().mosaicDashboard.runtime.panelIssuesByPanelId[
            getMosaicDashboardPanelId(dashboardId, panelId)
          ];
        },

        reportPanelIssue(dashboardId, panelId, issue) {
          const runtimePanelId = getMosaicDashboardPanelId(
            dashboardId,
            panelId,
          );
          set((state) => ({
            mosaicDashboard: {
              ...state.mosaicDashboard,
              runtime: {
                ...state.mosaicDashboard.runtime,
                panelIssuesByPanelId: {
                  ...state.mosaicDashboard.runtime.panelIssuesByPanelId,
                  [runtimePanelId]: issue,
                },
              },
            },
          }));
        },

        clearPanelIssue(dashboardId, panelId) {
          const runtimePanelId = getMosaicDashboardPanelId(
            dashboardId,
            panelId,
          );
          if (
            !get().mosaicDashboard.runtime.panelIssuesByPanelId[runtimePanelId]
          ) {
            return;
          }
          set((state) => {
            const nextPanelIssuesByPanelId = {
              ...state.mosaicDashboard.runtime.panelIssuesByPanelId,
            };
            delete nextPanelIssuesByPanelId[runtimePanelId];
            return {
              mosaicDashboard: {
                ...state.mosaicDashboard,
                runtime: {
                  ...state.mosaicDashboard.runtime,
                  panelIssuesByPanelId: nextPanelIssuesByPanelId,
                },
              },
            };
          });
        },

        evictPanelRuntime(dashboardId, panelId) {
          const runtimePanelId = getMosaicDashboardPanelId(
            dashboardId,
            panelId,
          );
          const existing =
            get().mosaicDashboard.runtime.retainedChartsByPanelId[
              runtimePanelId
            ];
          destroyDashboardRuntimeChart(existing);
          set((state) => {
            const nextRetainedChartsByPanelId = {
              ...state.mosaicDashboard.runtime.retainedChartsByPanelId,
            };
            const nextPanelIssuesByPanelId = {
              ...state.mosaicDashboard.runtime.panelIssuesByPanelId,
            };
            delete nextRetainedChartsByPanelId[runtimePanelId];
            delete nextPanelIssuesByPanelId[runtimePanelId];
            return {
              mosaicDashboard: {
                ...state.mosaicDashboard,
                runtime: {
                  ...state.mosaicDashboard.runtime,
                  retainedChartsByPanelId: nextRetainedChartsByPanelId,
                  panelIssuesByPanelId: nextPanelIssuesByPanelId,
                },
              },
            };
          });
        },

        evictDashboardRuntime(dashboardId, options) {
          const runtimePrefix = `dashboard:${dashboardId}:panel:`;
          const existingEntries = Object.entries(
            get().mosaicDashboard.runtime.retainedChartsByPanelId,
          ).filter(([runtimePanelId]) =>
            runtimePanelId.startsWith(runtimePrefix),
          );
          const existingIssueEntries = Object.keys(
            get().mosaicDashboard.runtime.panelIssuesByPanelId,
          ).filter((runtimePanelId) => runtimePanelId.startsWith(runtimePrefix));

          existingEntries.forEach(([, chart]) => {
            destroyDashboardRuntimeChart(chart);
          });

          if (options?.resetSelection) {
            evictDashboardSelection(get(), dashboardId);
          }

          set((state) => {
            const nextRetainedChartsByPanelId = {
              ...state.mosaicDashboard.runtime.retainedChartsByPanelId,
            };
            const nextPanelIssuesByPanelId = {
              ...state.mosaicDashboard.runtime.panelIssuesByPanelId,
            };
            for (const [runtimePanelId] of existingEntries) {
              delete nextRetainedChartsByPanelId[runtimePanelId];
            }
            for (const runtimePanelId of existingIssueEntries) {
              delete nextPanelIssuesByPanelId[runtimePanelId];
            }
            return {
              mosaicDashboard: {
                ...state.mosaicDashboard,
                runtime: {
                  ...state.mosaicDashboard.runtime,
                  retainedChartsByPanelId: nextRetainedChartsByPanelId,
                  panelIssuesByPanelId: nextPanelIssuesByPanelId,
                },
              },
            };
          });
        },

        clearAllDashboardRuntime() {
          Object.values(
            get().mosaicDashboard.runtime.retainedChartsByPanelId,
          ).forEach((chart) => {
            destroyDashboardRuntimeChart(chart);
          });
          set((state) => ({
            mosaicDashboard: {
              ...state.mosaicDashboard,
              runtime: {
                ...state.mosaicDashboard.runtime,
                retainedChartsByPanelId: {},
                panelIssuesByPanelId: {},
              },
            },
          }));
        },

        setLayout(dashboardId, layout) {
          get().mosaicDashboard.ensureDashboard(dashboardId);
          set((state) =>
            produce(state, (draft) => {
              const dashboard =
                draft.mosaicDashboard.config.dashboardsById[dashboardId];
              if (!dashboard) return;

              const panelIds = dashboard.panels.map((panel) => panel.id);
              const panelTypesByLayoutId = getDashboardPanelTypesByLayoutId(
                dashboardId,
                dashboard.panels,
              );
              dashboard.layout = ensureLayoutContainsDashboardPanels(
                layout,
                dashboardId,
                panelIds,
                dashboard.layoutType,
                panelTypesByLayoutId,
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
