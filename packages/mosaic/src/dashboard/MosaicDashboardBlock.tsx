import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {BarChart3} from 'lucide-react';
import type {ComponentType} from 'react';
import {MosaicDashboard} from './MosaicDashboard';
import type {
  MosaicDashboardLayoutType,
  MosaicDashboardSliceState,
} from './MosaicDashboardSlice';

export type MosaicDashboardBlockRenderProps<
  TRoomState extends MosaicDashboardSliceState = MosaicDashboardSliceState,
> = StatefulBlockRenderProps<TRoomState>;

export type CreateMosaicDashboardBlockDefinitionOptions<
  TRoomState extends MosaicDashboardSliceState = MosaicDashboardSliceState,
> = {
  render?: ComponentType<MosaicDashboardBlockRenderProps<TRoomState>>;
  label?: string;
  defaultTitle?: string;
  layoutType?: MosaicDashboardLayoutType;
};

const DefaultMosaicDashboardBlock = ({
  blockId,
}: MosaicDashboardBlockRenderProps) => {
  return <MosaicDashboard dashboardId={blockId} />;
};

export function createMosaicDashboardBlockDefinition<
  TRoomState extends MosaicDashboardSliceState = MosaicDashboardSliceState,
>({
  render = DefaultMosaicDashboardBlock as ComponentType<
    MosaicDashboardBlockRenderProps<TRoomState>
  >,
  label = 'Dashboard',
  defaultTitle = 'Dashboard',
  layoutType,
}: CreateMosaicDashboardBlockDefinitionOptions<TRoomState> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: 'dashboard',
    label,
    defaultTitle,
    icon: BarChart3,
    capabilities: {
      stateful: true,
      embeddable: true,
      selectable: true,
      hasRuntimeCache: true,
    },
    render,
    ensureState: ({blockId, title, getState}) => {
      getState().mosaicDashboard.ensureDashboard(
        blockId,
        title ?? defaultTitle,
        layoutType,
      );
    },
    rename: ({blockId, title, getState}) => {
      getState().mosaicDashboard.ensureDashboard(blockId, title, layoutType);
    },
    close: ({blockId, getState}) => {
      getState().mosaicDashboard.evictDashboardRuntime(blockId, {
        resetSelection: true,
      });
    },
    deleteState: ({blockId, getState}) => {
      getState().mosaicDashboard.removeDashboard(blockId);
    },
  };
}
