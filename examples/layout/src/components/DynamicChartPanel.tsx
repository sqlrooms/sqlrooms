import {RoomPanelComponent} from '@sqlrooms/layout';
import {DynamicChart} from './DynamicChart';
import {DynamicChartHeader} from './DynamicChartHeader';

export const DynamicChartPanel: RoomPanelComponent = ({meta, panelInfo}) => {
  const chartId = (meta?.chartId ?? '') as string;
  const title = panelInfo?.title ?? chartId;

  return (
    <>
      <DynamicChartHeader chartId={chartId} title={title} />
      <DynamicChart chartId={chartId} />
    </>
  );
};
