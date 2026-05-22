import {type FC} from 'react';
import {ChartSpecError, SpecGenerationError} from '../chart-types/errors';

interface MosaicDashboardVgPlotErrorProps {
  error: ChartSpecError;
}

export const MosaicDashboardVgPlotError: FC<
  MosaicDashboardVgPlotErrorProps
> = ({error}) => {
  // Configuration issues - user just needs to configure settings
  if (error instanceof SpecGenerationError) {
    return (
      <>
        <div className="text-center font-medium">
          Configure chart to display visualization
        </div>
        <div className="text-center text-xs">{error.message}</div>
      </>
    );
  }

  // Generic error fallback
  return (
    <>
      <div className="text-center font-medium">Unable to display chart</div>
      <div className="text-center text-xs">{error.message}</div>
    </>
  );
};
