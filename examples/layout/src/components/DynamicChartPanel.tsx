import {LeafLayout, RoomPanelComponent} from '@sqlrooms/layout';
import {DynamicChart} from './DynamicChart';

export const DynamicChartPanel: RoomPanelComponent = ({meta}) => {
  const chartId = (meta?.chartId ?? '') as string;

  return (
    <>
      <LeafLayout.Header />
      <DynamicChart chartId={chartId} />
    </>
  );
};
