import {DataTableModal} from '@sqlrooms/data-table';
import {DataTable} from '@sqlrooms/duckdb';
import {cn, useDisclosure} from '@sqlrooms/ui';
import {FC, useState} from 'react';
import {useBaseProjectBuilderStore} from '../ProjectBuilderStore';
import {TableCard, TableAction} from './TableCard';

const TablesListPanel: FC<{className?: string; isReadOnly?: boolean, tableActions?: TableAction[]}> = ({
  className,
  tableActions,
  isReadOnly,
}) => {
  const tables = useBaseProjectBuilderStore((state) => state.db.tables);
  const tableRowCounts = useBaseProjectBuilderStore(
    (state) => state.db.tableRowCounts,
  );

  const [selectedTable, setSelectedTable] = useState<DataTable | undefined>(
    undefined,
  );
  const {isOpen, onOpen, onClose} = useDisclosure();

  const handleClick = (table: DataTable) => {
    onOpen();
    setSelectedTable(table);
  };

  const handleClose = () => {
    onClose();
    setSelectedTable(undefined);
  };

  return (
    <>
      <div
        className={cn(
          'relative flex flex-grow flex-col items-stretch gap-2',
          className,
        )}
      >
        {tables?.length ? (
          <div className="flex flex-col gap-2">
            {tables.map((table, i) => (
              <TableCard
                key={i}
                onClick={() => handleClick(table)}
                isReadOnly={isReadOnly}
                value={table}
                rowCount={tableRowCounts[table.tableName]}
                tableActions={tableActions}
              />
            ))}
          </div>
        ) : null}
      </div>

      <DataTableModal
        className="h-[80vh] max-w-[75vw]"
        tableModal={{
          isOpen: isOpen,
          onClose: handleClose,
        }}
        title={selectedTable?.tableName}
        query={`SELECT * FROM ${selectedTable?.tableName}`}
      />
    </>
  );
};

export {TablesListPanel};
