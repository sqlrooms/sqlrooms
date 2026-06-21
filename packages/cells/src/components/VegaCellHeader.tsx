import {Button} from '@sqlrooms/ui';
import {produce} from 'immer';
import {Settings} from 'lucide-react';
import {fromDataSourceCell, fromDataSourceTable} from '../helpers';
import {CellSourceSelector} from './CellSourceSelector';
import {useCellsStore} from '../hooks';

export type VegaCellHeaderProps = {
  cellId: string;
  selectValue: string | undefined;
  onEditToggle: () => void;
  hasDataSource: boolean;
};

export const VegaCellHeader: React.FC<VegaCellHeaderProps> = ({
  cellId,
  selectValue,
  onEditToggle,
  hasDataSource,
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
    </div>
  );
};
