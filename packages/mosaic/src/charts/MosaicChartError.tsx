import {type FC} from 'react';

type MosaicChartErrorProps = {
  title: string;
  message: string;
};

export const MosaicChartError: FC<MosaicChartErrorProps> = ({
  title,
  message,
}) => {
  return (
    <>
      <div className="text-center font-medium">{title}</div>
      <div className="text-center text-xs">{message}</div>
    </>
  );
};
