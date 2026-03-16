import {cn} from '@sqlrooms/ui';
import {Param} from '@uwdata/mosaic-core';
import {Spec} from '@uwdata/mosaic-spec';
import React from 'react';
import {MosaicEditorContext} from './MosaicEditorContext';
import {MosaicEditorContextValue, OnMosaicSpecChange} from './types';
import {useMosaicChartEditor} from './useMosaicChartEditor';

export interface MosaicChartContainerProps {
  /**
   * Initial Mosaic specification
   */
  spec: Spec | string;
  /**
   * Pre-defined params/selections for shared cross-filtering
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Map<string, Param<any>>;
  /**
   * Whether editing is enabled
   * @default true
   */
  editable?: boolean;
  /**
   * Callback when spec changes are applied
   */
  onSpecChange?: OnMosaicSpecChange;
  /**
   * Child components (Chart, SpecEditor, Actions)
   */
  children: React.ReactNode;
  /**
   * Custom class name for the container
   */
  className?: string;
}

/**
 * Container component for composable Mosaic chart editing.
 * Provides context for child subcomponents.
 *
 * @example
 * ```tsx
 * <MosaicChart.Container
 *   spec={mySpec}
 *   params={paramsMap}
 *   editable={true}
 *   onSpecChange={(spec) => saveSpec(spec)}
 * >
 *   <MosaicChart.Chart />
 *   <MosaicChart.SpecEditor />
 *   <MosaicChart.Actions />
 * </MosaicChart.Container>
 * ```
 */
export const MosaicChartContainer: React.FC<MosaicChartContainerProps> = ({
  spec,
  params,
  editable = true,
  onSpecChange,
  children,
  className,
}) => {
  const {state, actions, canApply, hasChanges} = useMosaicChartEditor({
    initialSpec: spec,
    onSpecChange,
  });

  const contextValue: MosaicEditorContextValue = {
    state,
    actions,
    editable,
    params,
    canApply,
    hasChanges,
  };

  return (
    <MosaicEditorContext.Provider value={contextValue}>
      <div className={cn('flex flex-col gap-2', className)}>{children}</div>
    </MosaicEditorContext.Provider>
  );
};
