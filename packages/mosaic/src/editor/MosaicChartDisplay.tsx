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

const DEFAULT_CHART_HEIGHT = 200;

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

    const height = useMemo(() => {
      const h = spec && typeof spec === 'object' ? (spec as any).height : null;
      return typeof h === 'number' && h > 0 ? h : DEFAULT_CHART_HEIGHT;
    }, [spec]);

    return (
      <div className={cn('relative', className)} style={{height}}>
        <VgPlotChart spec={spec} params={params} />
      </div>
    );
  },
);

MosaicChartDisplay.displayName = 'MosaicChartDisplay';
