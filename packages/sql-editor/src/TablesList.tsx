import {Button} from '@sqlrooms/ui';
import {TableIcon} from 'lucide-react';
import type {FC} from 'react';

type OnSelectCallback = (name: string) => void;

const TablesList: FC<{
  schema: string;
  tableNames: string[];
  selectedTable?: string;
  onSelect: OnSelectCallback;
  onChange?: () => void;
  renderTableButton?: (
    tableName: string,
    onSelect: OnSelectCallback,
  ) => React.ReactNode;
}> = (props) => {
  const {
    tableNames,
    selectedTable,
    onSelect,
    renderTableButton = (tableName: string, onSelect: OnSelectCallback) => (
      <Button
        className="min-h-[25px] w-full select-text justify-start overflow-hidden whitespace-normal break-words text-left text-sm font-normal"
        variant={selectedTable === tableName ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onSelect(tableName)}
      >
        <TableIcon className="h-4 w-4" />
        {tableName}
      </Button>
    ),
  } = props;

  return (
    <div className="bg-background/10 h-full overflow-auto px-2 py-4">
      <ul className="space-y-1">
        {tableNames.map((tableName, i) => (
          <li key={i}>
            <div className="flex items-center gap-1">
              {renderTableButton(tableName, onSelect)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export {TablesList};
