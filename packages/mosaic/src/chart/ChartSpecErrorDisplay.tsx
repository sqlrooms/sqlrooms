import {type FC} from 'react';
import {ChartSpecError, SpecGenerationError} from '../chart-types/errors';

interface ChartSpecErrorDisplayProps {
  error: ChartSpecError;
}

/**
 * Displays chart specification errors with appropriate styling.
 * Configuration errors (like missing required fields) are shown with a neutral tone,
 * while actual errors (like missing table) are shown with emphasis.
 */
export const ChartSpecErrorDisplay: FC<ChartSpecErrorDisplayProps> = ({
  error,
}) => {
  // Configuration issues - user just needs to configure settings
  if (error instanceof SpecGenerationError) {
    return (
      <>
        <div>Configure chart to display visualization</div>
        <div className="text-xs">{error.message}</div>
      </>
    );
  }

  // Generic error fallback
  return (
    <>
      <div className="font-medium">Unable to display chart</div>
      <div className="text-xs">{error.message}</div>
    </>
  );
};
