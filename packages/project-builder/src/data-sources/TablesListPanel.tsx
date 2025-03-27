import {DataTableModal} from '@sqlrooms/data-table';
import {DataTable} from '@sqlrooms/duckdb';
import {useDisclosure} from '@sqlrooms/ui';
import {FC, useState} from 'react';
import {useBaseProjectBuilderStore} from '../ProjectBuilderStore';
import {TableCard} from './TableCard';

const TablesListPanel: FC = () => {
  const isReadOnly = useBaseProjectBuilderStore(
    (state) => state.project.isReadOnly,
  );

  const tables = useBaseProjectBuilderStore((state) => state.project.tables);
  const tableRowCounts = useBaseProjectBuilderStore(
    (state) => state.project.tableRowCounts,
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
      <div className="relative flex flex-grow flex-col items-stretch gap-2">
        {tables?.length ? (
          <div className="flex flex-col gap-2">
            {tables.map((table, i) => (
              <TableCard
                key={i}
                onClick={() => handleClick(table)}
                isReadOnly={isReadOnly}
                value={table}
                rowCount={tableRowCounts[table.tableName]}
              />
            ))}
          </div>
        ) : null}
      </div>

      <DataTableModal
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
