import {DataTableModal} from '@sqlrooms/data-table';
import {DataTable} from '@sqlrooms/duckdb';
import {FC, useState} from 'react';
import {useBaseProjectStore} from '../ProjectStateProvider';
import {TableCard} from './TableCard';

const TablesListPanel: FC = () => {
  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);

  const tables = useBaseProjectStore((state) => state.tables);
  const tableRowCounts = useBaseProjectStore((state) => state.tableRowCounts);

  const [selectedTable, setSelectedTable] = useState<DataTable | undefined>(
    undefined,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = (table: DataTable) => {
    setIsModalOpen(true);
    setSelectedTable(table);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedTable(undefined);
  };

  return (
    <>
      <div className="flex gap-2 flex-col flex-grow items-stretch relative">
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
          isOpen: isModalOpen,
          onClose: handleClose,
        }}
        title={selectedTable?.tableName}
        query={`SELECT * FROM ${selectedTable?.tableName}`}
      />
    </>
  );
};

export {TablesListPanel};
