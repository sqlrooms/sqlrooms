import {cn} from '@sqlrooms/ui';
import React, {useMemo} from 'react';
import {VgPlotChart} from '../VgPlotChart';
import {useMosaicEditorContext} from './MosaicEditorContext';

export interface MosaicChartDisplayProps {
  /**
   * Custom class name for the chart container
   */
  className?: string;
}

/**
 * Chart display subcomponent for MosaicChart.Container.
 * Renders the VgPlotChart with the current spec from editor context.
 *
 * Uses the last valid spec for rendering, so the chart keeps
 * displaying even during typing with invalid JSON.
 *
 * Must be used within a MosaicChart.Container component.
 */
export const MosaicChartDisplay: React.FC<MosaicChartDisplayProps> = React.memo(
  ({className}) => {
    const {state, params} = useMosaicEditorContext();

    const spec = useMemo(
      () => state.parsedSpec ?? state.lastValidSpec,
      [state.parsedSpec, state.lastValidSpec],
    );

    return (
      <div className={cn('relative', className)}>
        <VgPlotChart spec={spec} params={params} />
      </div>
    );
  },
);

MosaicChartDisplay.displayName = 'MosaicChartDisplay';
