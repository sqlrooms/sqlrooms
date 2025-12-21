import {VegaLiteChart, type VisualizationSpec} from '@sqlrooms/vega';
import {FC} from 'react';
import type {VegaCellData} from '@sqlrooms/cells';
import {useStoreWithCanvas} from '../CanvasSlice';
import {CanvasNodeContainer} from './CanvasNodeContainer';

export const VegaNode: FC<{id: string; data: VegaCellData}> = ({id, data}) => {
  const spec = (data.vegaSpec || {
    mark: 'point',
    data: {values: []},
  }) as VisualizationSpec;

  const {vegaSpec, sql, sqlId} = data;
  const cellsData = useStoreWithCanvas((s) => s.cells.data);
  const cellsStatus = useStoreWithCanvas((s) => s.cells.status);

  const effectiveSql =
    sql ||
    (sqlId && cellsData[sqlId]?.type === 'sql'
      ? (cellsData[sqlId] as any).data.sql
      : undefined);
  const status = sqlId ? cellsStatus[sqlId] : undefined;
  const isLoading = status?.type === 'sql' && status.status === 'running';

  return (
    <CanvasNodeContainer
      id={id}
      headerRight={
        <span className="text-[10px] uppercase text-gray-500">Vega</span>
      }
    >
      <div className="h-full flex-1 overflow-hidden p-2">
        {effectiveSql && vegaSpec ? (
          <VegaLiteChart
            spec={vegaSpec}
            sqlQuery={effectiveSql}
            aspectRatio={3 / 2}
            className="h-full"
            isLoading={isLoading}
          />
        ) : null}
      </div>
    </CanvasNodeContainer>
  );
};
