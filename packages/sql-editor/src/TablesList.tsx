import {Button} from '@sqlrooms/ui';
import {TableIcon} from 'lucide-react';
import type {FC} from 'react';

type Props = {
  schema: string;
  tableNames: string[];
  selectedTable?: string;
  onSelect: (name: string) => void;
  onChange?: () => void;
  renderTableButton?: (
    tableName: string,
    onSelect: Props['onSelect'],
  ) => React.ReactNode;
};

const TablesList: FC<Props> = (props) => {
  const {
    tableNames,
    selectedTable,
    onSelect,
    renderTableButton = (tableName: string, onSelect: Props['onSelect']) => (
      <Button
        className="w-full justify-start font-normal overflow-hidden whitespace-normal min-h-[25px] text-sm text-left break-words select-text"
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
    <div className="h-full bg-background/10 px-2 py-4 overflow-auto">
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
