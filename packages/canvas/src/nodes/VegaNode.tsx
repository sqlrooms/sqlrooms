import {FC} from 'react';
import {CanvasNodeData, useStoreWithCanvas} from '../CanvasSlice';
import {VegaLiteChart, type VisualizationSpec} from '@sqlrooms/vega';
import {CanvasNodeContainer} from './CanvasNodeContainer';
import {EditableText} from '@sqlrooms/ui';

type VegaData = Extract<CanvasNodeData, {type: 'vega'}>;

export const VegaNode: FC<{id: string; data: VegaData}> = ({id, data}) => {
  const spec = (data.vegaSpec || {
    mark: 'point',
    data: {values: []},
  }) as VisualizationSpec;
  const defaultQuery =
    "SELECT * FROM (VALUES ('A', 28), ('B', 55), ('C', 43)) AS t(category, value)";
  const updateNode = useStoreWithCanvas((s) => s.canvas.updateNode);
  return (
    <CanvasNodeContainer id={id}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
          <EditableText
            value={data.title}
            onChange={(value) => {
              updateNode(id, (d) => ({...(d as VegaData), title: v}));
            }}
          />
          <span className="text-[10px] uppercase text-gray-500">Vega</span>
        </div>
        <div className="flex-1 overflow-hidden p-2">
          <VegaLiteChart
            spec={spec}
            sqlQuery={defaultQuery}
            aspectRatio={3 / 2}
            className="h-full"
          />
        </div>
      </div>
    </CanvasNodeContainer>
  );
};
