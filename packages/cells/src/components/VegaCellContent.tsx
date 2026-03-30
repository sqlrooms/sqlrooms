import {useDebouncedValue} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import {produce} from 'immer';
import {useCallback, useState} from 'react';
import {useCellsStore} from '../hooks';
import {useVegaCellQuery} from '../hooks/useVegaCellQuery';
import {useVegaCellDataSource} from '../hooks/useVegaCellDataSource';
import type {CellContainerProps, VegaCell} from '../types';
import {SelectionListener} from './SelectionListener';
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

  const crossFilterEnabled = cell.data.crossFilter?.enabled !== false;
  const brushField = cell.data.crossFilter?.brushField;
  const brushFieldType = cell.data.crossFilter?.brushFieldType;

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

  const {selectedSqlQuery, crossFilterPredicate} = useVegaCellQuery({
    cellId: id,
    baseSqlQuery,
    selectedSqlId,
    crossFilterEnabled,
  });

  // Encode selection value: "cell:<id>" or "table:<schema.table>"
  const selectValue = selectedSqlId
    ? toDataSourceCell(selectedSqlId)
    : selectedTableRef
      ? toDataSourceTable(selectedTableRef)
      : undefined;

  const handleCrossFilterToggle = useCallback(
    (enabled: boolean) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'vega') {
            if (!draft.data.crossFilter) draft.data.crossFilter = {};
            draft.data.crossFilter.enabled = enabled;
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleBrushFieldChange = useCallback(
    (field: string | undefined) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'vega') {
            if (!draft.data.crossFilter) draft.data.crossFilter = {};
            draft.data.crossFilter.brushField = field;
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleBrushFieldTypeChange = useCallback(
    (fieldType: string | undefined) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'vega') {
            if (!draft.data.crossFilter) draft.data.crossFilter = {};
            draft.data.crossFilter.brushFieldType = fieldType;
          }
        }),
      );
    },
    [id, updateCell],
  );

  const header = (
    <VegaCellHeader
      cellId={id}
      selectValue={selectValue}
      onEditToggle={() => setIsEditing((prev) => !prev)}
      hasDataSource={hasDataSource}
      crossFilterEnabled={crossFilterEnabled}
      brushField={brushField}
      crossFilterPredicate={crossFilterPredicate}
    />
  );

  const showSelectionListener =
    crossFilterEnabled && brushField && selectedSqlId && selectedSqlStatus;

  const content = (
    <div className="flex h-[400px]">
      {isEditing && (
        <VegaConfigPanel
          sqlQuery={baseSqlQuery}
          lastRunTime={lastRunTime}
          spec={localSpec}
          crossFilterEnabled={crossFilterEnabled}
          onSpecChange={handleSpecChange}
          onCrossFilterToggle={handleCrossFilterToggle}
          onBrushFieldChange={handleBrushFieldChange}
          onBrushFieldTypeChange={handleBrushFieldTypeChange}
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
          >
            {showSelectionListener && (
              <SelectionListener
                cellId={id}
                sqlId={selectedSqlId}
                brushField={brushField}
                brushFieldType={brushFieldType}
              />
            )}
          </VegaLiteChart>
        )}
      </div>
    </div>
  );

  return renderContainer({
    header,
    content,
  });
};
