import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {BarChart3} from 'lucide-react';
import type {ComponentType} from 'react';
import {DefaultMosaicDashboardBlock} from './DefaultMosaicDashboardBlock';
import {MosaicDashboardSettings} from './MosaicDashboardSettings';
import type {
  MosaicDashboardLayoutType,
  MosaicDashboardSliceState,
} from './MosaicDashboardSlice';
import type {StatefulBlockSettingsProps} from '@sqlrooms/blocks';

export type MosaicDashboardBlockRenderProps<
  TRoomState extends MosaicDashboardSliceState = MosaicDashboardSliceState,
> = StatefulBlockRenderProps<TRoomState>;

export type CreateMosaicDashboardBlockDefinitionOptions<
  TRoomState extends MosaicDashboardSliceState = MosaicDashboardSliceState,
> = {
  render?: ComponentType<MosaicDashboardBlockRenderProps<TRoomState>>;
  settings?: ComponentType<StatefulBlockSettingsProps<TRoomState>>;
  label?: string;
  defaultTitle?: string;
  layoutType?: MosaicDashboardLayoutType;
};

export function createMosaicDashboardBlockDefinition<
  TRoomState extends MosaicDashboardSliceState = MosaicDashboardSliceState,
>({
  render = DefaultMosaicDashboardBlock as ComponentType<
    MosaicDashboardBlockRenderProps<TRoomState>
  >,
  settings = MosaicDashboardSettings as ComponentType<
    StatefulBlockSettingsProps<TRoomState>
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
    settings,
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
