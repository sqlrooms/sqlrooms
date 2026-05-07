import {Button, Tooltip, TooltipContent, TooltipTrigger} from '@sqlrooms/ui';
import {produce} from 'immer';
import {Filter, Settings} from 'lucide-react';
import {fromDataSourceCell, fromDataSourceTable} from '../helpers';
import {CellSourceSelector} from './CellSourceSelector';
import {useCellsStore} from '../hooks';

export type VegaCellHeaderProps = {
  cellId: string;
  selectValue: string | undefined;
  onEditToggle: () => void;
  hasDataSource: boolean;
  crossFilterEnabled: boolean;
  brushField: string | undefined;
  crossFilterPredicate: string | null;
};

export const VegaCellHeader: React.FC<VegaCellHeaderProps> = ({
  cellId,
  selectValue,
  onEditToggle,
  hasDataSource,
  crossFilterEnabled,
  brushField,
  crossFilterPredicate,
}) => {
  const updateCell = useCellsStore((s) => s.cells.updateCell);
  const artifactId = useCellsStore((s) => s.cells.getArtifactIdForCell(cellId));

  const handleDataSourceChange = (value: string) => {
    updateCell(cellId, (c) =>
      produce(c, (draft) => {
        if (draft.type !== 'vega') {
          return;
        }

        const cellIdFromValue = fromDataSourceCell(value);
        const tableRef = fromDataSourceTable(value);

        if (cellIdFromValue) {
          draft.data.sqlId = cellIdFromValue;
          delete draft.data.tableRef;
        } else if (tableRef) {
          draft.data.tableRef = tableRef;
          delete draft.data.sqlId;
        }
      }),
    );
  };

  return (
    <div className="flex items-center gap-2">
      <CellSourceSelector
        artifactId={artifactId ?? ''}
        value={selectValue}
        onValueChange={handleDataSourceChange}
      />
      <Button
        size="xs"
        variant="secondary"
        className="h-6"
        onClick={onEditToggle}
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
};
