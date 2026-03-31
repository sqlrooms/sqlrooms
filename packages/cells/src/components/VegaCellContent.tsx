import {useDebouncedValue} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import {produce} from 'immer';
import {useState} from 'react';
import {useCellsStore} from '../hooks';
import {useVegaCellQuery} from '../hooks/useVegaCellQuery';
import {useVegaCellVersion} from '../hooks/useVegaCellVersion';
import type {CellContainerProps, VegaCell} from '../types';
import {SelectionListener} from './SelectionListener';
import {VegaConfigPanel} from './VegaConfigPanel';
import {VegaCellHeader} from './VegaCellHeader';
import {useVegaCrossFilterOptions} from '../hooks/useVegaCrossFilterOptions';

const DEFAULT_SPEC = {
  data: {name: 'queryResult'},
  width: 'container' as const,
  height: 'container' as const,
  mark: 'bar',
  padding: 20,
};

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

  const version = useVegaCellVersion(cell);

  const selectedSqlQuery = useVegaCellQuery(cell);

  const hasDataSource = Boolean(selectedSqlQuery);

  const {showSelectionListener} = useVegaCrossFilterOptions(cell);

  const header = (
    <VegaCellHeader
      cell={cell}
      onEditToggle={() => setIsEditing((prev) => !prev)}
      hasDataSource={Boolean(selectedSqlQuery)}
    />
  );

  const content = (
    <div className="flex h-[400px]">
      {isEditing && (
        <VegaConfigPanel
          cell={cell}
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
        ) : !selectedSqlQuery ? (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No chart data available, please run the SQL cell first.
          </div>
        ) : (
          <VegaLiteChart
            sqlQuery={selectedSqlQuery}
            spec={localSpec}
            version={version}
            className="h-full w-full"
          >
            {showSelectionListener && <SelectionListener cell={cell} />}
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
