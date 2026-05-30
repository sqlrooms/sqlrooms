import {useDebouncedValue} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import {produce} from 'immer';
import {useState} from 'react';
import {useCellsStore} from '../hooks';
import {useVegaCellQuery} from '../hooks/useVegaCellQuery';
import {useVegaCellDataSource} from '../hooks/useVegaCellDataSource';
import type {CellContainerProps, VegaCell} from '../types';
import {VegaConfigPanel} from './VegaConfigPanel';
import {VegaCellHeader} from './VegaCellHeader';
import {toDataSourceCell, toDataSourceTable} from '../helpers';

const DEFAULT_ASPECT_RATIO = 3 / 2;
const DEFAULT_SPEC = {
  data: {name: 'queryResult'},
  mark: 'bar',
  padding: 20,
} as const;

export type VegaCellContentProps = {
  id: string;
  cell: VegaCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

export const VegaCellContent: React.FC<VegaCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const updateCell = useCellsStore((s) => s.cells.updateCell);

  const [isEditing, setIsEditing] = useState(false);

  // Local state with debounced persistence
  const [localSpec, handleSpecChange] = useDebouncedValue(
    cell.data.vegaSpec ?? DEFAULT_SPEC,
    (spec) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'vega') draft.data.vegaSpec = spec;
        }),
      );
    },
    300,
  );

  const {
    selectedSqlId,
    selectedTableRef,
    selectedSqlStatus,
    baseSqlQuery,
    lastRunTime,
    hasDataSource,
  } = useVegaCellDataSource(cell);

  const {selectedSqlQuery} = useVegaCellQuery({
    baseSqlQuery,
  });

  // Encode selection value: "cell:<id>" or "table:<schema.table>"
  const selectValue = selectedSqlId
    ? toDataSourceCell(selectedSqlId)
    : selectedTableRef
      ? toDataSourceTable(selectedTableRef)
      : undefined;

  const header = (
    <VegaCellHeader
      cellId={id}
      selectValue={selectValue}
      onEditToggle={() => setIsEditing((prev) => !prev)}
      hasDataSource={hasDataSource}
    />
  );

  const content = (
    <div className="flex h-[400px]">
      {isEditing && (
        <VegaConfigPanel
          sqlQuery={baseSqlQuery}
          lastRunTime={lastRunTime}
          spec={localSpec}
          onSpecChange={handleSpecChange}
        />
      )}
      <div
        onDoubleClick={() => hasDataSource && setIsEditing((prev) => !prev)}
        className="flex h-full w-full p-2"
      >
        {!hasDataSource ? (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            Please select a data source first.
          </div>
        ) : !selectedSqlStatus && !selectedTableRef ? (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No chart data available, please run the SQL cell first.
          </div>
        ) : (
          <VegaLiteChart
            sqlQuery={selectedSqlQuery}
            spec={localSpec}
            className="h-full w-full"
            aspectRatio={isEditing ? undefined : DEFAULT_ASPECT_RATIO}
          />
        )}
      </div>
    </div>
  );

  return renderContainer({
    header,
    content,
  });
};
