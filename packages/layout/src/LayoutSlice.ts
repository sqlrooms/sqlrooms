import {
  RoomState,
  createBaseSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-store';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {produce} from 'immer';
import {z} from 'zod';
import React from 'react';
import {StateCreator} from 'zustand';
import {
  LayoutConfig,
  DEFAULT_MOSAIC_LAYOUT,
  MAIN_VIEW,
} from '@sqlrooms/layout-config';
import {getVisibleMosaicLayoutPanels, makeMosaicStack} from './mosaic/mosaic-utils';

// Helper function to get panels by placement
function getPanelsByPlacement(panels: Record<string, RoomPanelInfo>, placement: string): string[] {
  return Object.keys(panels).filter(panelId => panels[panelId]?.placement === placement);
}

// Helper function to build layout using existing mosaic utilities
function buildLayout(panels: Record<string, RoomPanelInfo>, visiblePanels: string[]): any {
  const sidebarTopPanels = getPanelsByPlacement(panels, 'sidebar-top').filter(p => visiblePanels.includes(p));
  const sidebarBottomPanels = getPanelsByPlacement(panels, 'sidebar-bottom').filter(p => visiblePanels.includes(p));
  const mainPanels = getPanelsByPlacement(panels, 'main').filter(p => visiblePanels.includes(p));
  const mainBottomPanels = getPanelsByPlacement(panels, 'main-bottom').filter(p => visiblePanels.includes(p));
  
  // Build sidebar column using makeMosaicStack
  const sidebarChildren = [
    ...sidebarTopPanels.map(panel => ({node: panel, weight: 1})),
    ...sidebarBottomPanels.map(panel => ({node: panel, weight: 1}))
  ];
  const sidebarColumn = makeMosaicStack('column', sidebarChildren);
  
  // Build main column using makeMosaicStack
  const mainChildren = [
    ...mainPanels.map(panel => ({node: panel, weight: 3})), // Main panels get more weight
    ...mainBottomPanels.map(panel => ({node: panel, weight: 2}))
  ];
  const mainColumn = makeMosaicStack('column', mainChildren);
  
  // Build root layout using makeMosaicStack
  const rootChildren = [
    ...(sidebarColumn ? [{node: sidebarColumn, weight: 1}] : []),
    ...(mainColumn ? [{node: mainColumn, weight: 3}] : [])
  ];
  
  return makeMosaicStack('row', rootChildren) || DEFAULT_MOSAIC_LAYOUT.nodes;
}


export type RoomPanelInfo = {
  title?: string;
  icon?: React.ComponentType<{className?: string}>;
  component: React.ComponentType;
  placement: 'sidebar-top' | 'sidebar-bottom' | 'main' | 'main-bottom';
};

export const LayoutSliceConfig = z.object({
  layout: z
    .any()
    .describe('Mosaic layout configuration.')
    .default(DEFAULT_MOSAIC_LAYOUT),
});

export type LayoutSliceConfig = z.infer<typeof LayoutSliceConfig>;

export function createDefaultLayoutConfig(): LayoutSliceConfig {
  return {
    layout: DEFAULT_MOSAIC_LAYOUT,
  };
}

export type LayoutSliceState = {
  layout: {
    panels: Record<string, RoomPanelInfo>;
    setLayout(layout: LayoutConfig): void;
    togglePanel: (panel: string, show?: boolean) => void;
  };
};

export function createLayoutSlice<
  PC extends BaseRoomConfig & LayoutSliceConfig,
>({
  panels = {},
}: {
  panels?: Record<string, RoomPanelInfo>;
} = {}): StateCreator<LayoutSliceState> {
  return createBaseSlice<PC, LayoutSliceState>((set, get) => ({
      layout: {
        panels,
        setLayout: (layout) =>
          set((state) =>
            produce(state, (draft) => {
              draft.config.layout = layout;
            }),
          ),
      togglePanel: (panel, show) => {
        // Main panel should always be visible and not toggleable
        if (panel === MAIN_VIEW) {
          return;
        }
        
        set((state) =>
          produce(state, (draft) => {
            const layout = draft.config.layout;
            const visiblePanels = getVisibleMosaicLayoutPanels(layout.nodes);
            const isCurrentlyVisible = visiblePanels.includes(panel);
            
            // Determine the desired visibility state
            const shouldShow = show ? show : !isCurrentlyVisible;
            
            if (shouldShow) {
              // Show panel - rebuild layout with this panel included
              const newVisiblePanels = [...visiblePanels, panel];
              layout.nodes = buildLayout(draft.layout.panels, newVisiblePanels);
            } else {
              // Hide panel - rebuild layout without this panel
              const newVisiblePanels = visiblePanels.filter(p => p !== panel);
              layout.nodes = buildLayout(draft.layout.panels, newVisiblePanels);
            }
          }),
        );
      }
    },
  }));
}

type RoomConfigWithLayout = BaseRoomConfig & LayoutSliceConfig;
type RoomStateWithLayout = RoomState<RoomConfigWithLayout> & LayoutSliceState;

export function useStoreWithLayout<T>(
  selector: (state: RoomStateWithLayout) => T,
): T {
  return useBaseRoomStore<
    BaseRoomConfig & LayoutSliceConfig,
    RoomState<RoomConfigWithLayout>,
    T
  >((state) => selector(state as unknown as RoomStateWithLayout));
}
