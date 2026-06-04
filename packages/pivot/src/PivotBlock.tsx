import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {Table2Icon} from 'lucide-react';
import type {ComponentType} from 'react';
import {PivotView} from './PivotView';
import type {PivotConfig, PivotSliceState, PivotSource} from './types';

export type PivotBlockRenderProps<
  TRoomState extends PivotSliceState = PivotSliceState,
> = StatefulBlockRenderProps<TRoomState>;

export type CreatePivotBlockDefinitionOptions<
  TRoomState extends PivotSliceState = PivotSliceState,
> = {
  render?: ComponentType<PivotBlockRenderProps<TRoomState>>;
  label?: string;
  defaultTitle?: string;
  source?: PivotSource;
  config?: Partial<PivotConfig>;
};

const DefaultPivotBlock = ({blockId}: PivotBlockRenderProps) => {
  return <PivotView pivotId={blockId} />;
};

export function createPivotBlockDefinition<
  TRoomState extends PivotSliceState = PivotSliceState,
>({
  render = DefaultPivotBlock as ComponentType<PivotBlockRenderProps<TRoomState>>,
  label = 'Pivot Table',
  defaultTitle = 'Pivot Table',
  source,
  config,
}: CreatePivotBlockDefinitionOptions<TRoomState> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: 'pivot',
    label,
    defaultTitle,
    icon: Table2Icon,
    capabilities: {
      stateful: true,
      embeddable: true,
      executable: true,
      producesRelation: true,
      hasRuntimeCache: true,
    },
    render,
    ensureState: ({blockId, title, getState}) => {
      getState().pivot.ensurePivot(blockId, {
        title: title ?? defaultTitle,
        source,
        config,
      });
    },
    rename: ({blockId, title, getState}) => {
      getState().pivot.renamePivot(blockId, title);
    },
    deleteState: ({blockId, getState}) => {
      getState().pivot.removePivot(blockId);
    },
  };
}
