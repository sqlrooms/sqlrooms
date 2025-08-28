import {VegaLiteChart, type VisualizationSpec} from '@sqlrooms/vega';
import {FC} from 'react';
import {CanvasNodeData} from '../CanvasSlice';
import {CanvasNodeContainer} from './CanvasNodeContainer';

type VegaData = Extract<CanvasNodeData, {type: 'vega'}>;

export const VegaNode: FC<{id: string; data: VegaData}> = ({id, data}) => {
  const spec = (data.vegaSpec || {
    mark: 'point',
    data: {values: []},
  }) as VisualizationSpec;
  const defaultQuery =
    "SELECT * FROM (VALUES ('A', 28), ('B', 55), ('C', 43)) AS t(category, value)";
  return (
    <CanvasNodeContainer
      id={id}
      headerRight={
        <span className="text-[10px] uppercase text-gray-500">Vega</span>
      }
    >
      <div className="h-full flex-1 overflow-hidden p-2">
        <VegaLiteChart
          spec={spec}
          sqlQuery={defaultQuery}
          aspectRatio={3 / 2}
          className="h-full"
        />
      </div>
    </CanvasNodeContainer>
  );
};
