import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useDebouncedCallback,
} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import {produce} from 'immer';
import {Filter, Settings} from 'lucide-react';
import React, {useCallback, useState} from 'react';
import {useCellsStore} from '../hooks';
import {useVegaCellQuery} from '../hooks/useVegaCellQuery';
import {useVegaCellDataSource} from '../hooks/useVegaCellDataSource';
import type {CellContainerProps, VegaCell} from '../types';
import {CellSourceSelector} from './CellSourceSelector';
import {SelectionListener} from './SelectionListener';
import {VegaConfigPanel} from './VegaConfigPanel';
import {
  toDataSourceCell,
  toDataSourceTable,
  fromDataSourceCell,
  fromDataSourceTable,
} from '../helpers';

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

  const vegaSpec = cell.data.vegaSpec ?? {
    data: {name: 'queryResult'},
    mark: 'bar',
    padding: 20,
  };

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

  const handleDataSourceChange = (value: string) => {
    updateCell(id, (c) =>
      produce(c, (draft) => {
        if (draft.type !== 'vega') {
          return;
        }

        const cellId = fromDataSourceCell(value);
        const tableRef = fromDataSourceTable(value);

        if (cellId) {
          draft.data.sqlId = cellId;
          delete draft.data.tableRef;
        } else if (tableRef) {
          draft.data.tableRef = tableRef;
          delete draft.data.sqlId;
        }
      }),
    );
  };

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

  const handleSpecChange = useDebouncedCallback((spec: any) => {
    updateCell(id, (c) =>
      produce(c, (draft) => {
        if (draft.type === 'vega') draft.data.vegaSpec = spec;
      }),
    );
  }, 300);

  const header = (
    <div className="flex items-center gap-2">
      <CellSourceSelector
        value={selectValue}
        onValueChange={handleDataSourceChange}
      />
      <Button
        size="xs"
        variant="secondary"
        className="h-6"
        onClick={() => setIsEditing((prev) => !prev)}
        disabled={!hasDataSource}
      >
        <Settings className="h-4 w-4" />
      </Button>
      {crossFilterEnabled && brushField && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <Filter
                className={`h-3.5 w-3.5 ${crossFilterPredicate ? 'text-blue-500' : 'text-gray-400'}`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              {crossFilterPredicate
                ? `Filtered: ${crossFilterPredicate}`
                : `Cross-filter on ${brushField}`}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const showSelectionListener =
    crossFilterEnabled && brushField && selectedSqlId && selectedSqlStatus;

  const content = (
    <div className="flex h-[400px]">
      {isEditing && (
        <VegaConfigPanel
          sqlQuery={baseSqlQuery}
          lastRunTime={lastRunTime}
          spec={vegaSpec}
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
            spec={vegaSpec}
            className="h-full w-full"
            aspectRatio={isEditing ? undefined : 3 / 2}
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
