import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import {useBaseRoomStore} from '@sqlrooms/room-store';
import {Table2Icon} from 'lucide-react';
import {useEffect, type ComponentType} from 'react';
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

export type PivotBlockProps = PivotBlockRenderProps & {
  pivotId?: string;
  defaultTitle?: string;
  source?: PivotSource;
  config?: Partial<PivotConfig>;
};

export const PivotBlock = ({
  blockId,
  pivotId,
  title,
  defaultTitle = 'Pivot Table',
  source,
  config,
}: PivotBlockProps) => {
  const resolvedPivotId = pivotId ?? blockId;
  const ensurePivot = useBaseRoomStore(
    (state: PivotSliceState) => state.pivot.ensurePivot,
  );

  useEffect(() => {
    if (!resolvedPivotId) return;
    ensurePivot(resolvedPivotId, {
      title: title ?? defaultTitle,
      source,
      config,
    });
  }, [config, defaultTitle, ensurePivot, resolvedPivotId, source, title]);

  if (!resolvedPivotId) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Pivot block is missing a pivot id.
      </div>
    );
  }

  return <PivotView pivotId={resolvedPivotId} />;
};

export function createPivotBlockDefinition<
  TRoomState extends PivotSliceState = PivotSliceState,
>({
  render = PivotBlock as ComponentType<PivotBlockRenderProps<TRoomState>>,
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
