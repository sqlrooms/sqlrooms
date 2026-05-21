import type {Coordinator} from '@uwdata/mosaic-core';
import {FC, useEffect} from 'react';
import {UseGenerateSpecResult} from './useGenerateSpec';
import {MosaicDashboardVgPlotError} from './MosaicDashboardVgPlotError';
import {VgPlotChart} from '../VgPlotChart';
import {ChartRetainer, BrushSelectionParams} from '../chart-types/base-types';
import {setCoordinatorMaxDataPoints} from '../wrapCoordinatorWithValidation';

export type MosaicDashboardVgPlotChartProps = {
  spec: UseGenerateSpecResult;
  retention: ChartRetainer;
  params: BrushSelectionParams | undefined;
  coordinator: Coordinator;
  maxDataPoints?: number;
};

export const MosaicDashboardVgPlotChart: FC<
  MosaicDashboardVgPlotChartProps
> = ({spec, retention, params, coordinator, maxDataPoints}) => {
  // Set chart-specific maxDataPoints before rendering
  useEffect(() => {
    if (maxDataPoints !== undefined) {
      setCoordinatorMaxDataPoints(coordinator, maxDataPoints);
    }
    return () => {
      // Clear override on unmount
      setCoordinatorMaxDataPoints(coordinator, undefined);
    };
  }, [coordinator, maxDataPoints]);

  if (spec.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <MosaicDashboardVgPlotError error={spec.error} />
      </div>
    );
  }

  return <VgPlotChart spec={spec.spec} params={params} retention={retention} />;
};
