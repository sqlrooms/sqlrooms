import {FC} from 'react';
import {DataPointLimitError} from './DataPointLimitError';

type VgPlotChartErrorProps = {
  error: Error;
};

export const VgPlotChartError: FC<VgPlotChartErrorProps> = ({error}) => {
  const title =
    error instanceof DataPointLimitError
      ? 'Too much data'
      : 'Unable to display chart';

  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center p-4">
      <div className="mb-2 text-center font-semibold">{title}</div>
      <div className="text-center text-sm whitespace-pre-wrap">
        {error.message}
      </div>
    </div>
  );
};
