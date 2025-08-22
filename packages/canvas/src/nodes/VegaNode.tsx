import {FC} from 'react';
import {CanvasNodeData} from '../CanvasSlice';
import {VegaLiteChart, type VisualizationSpec} from '@sqlrooms/vega';
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
    <CanvasNodeContainer id={id}>
      <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
        <span>{data.title}</span>
        <span className="text-[10px] uppercase text-gray-500">Vega</span>
      </div>
      <div className="p-2">
        <VegaLiteChart spec={spec} height={180} sqlQuery={defaultQuery} />
      </div>
    </CanvasNodeContainer>
  );
};
