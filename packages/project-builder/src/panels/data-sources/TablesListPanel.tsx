import {DataTableModal} from '@sqlrooms/data-table';
import {DataTable} from '@sqlrooms/duckdb';
import {useBaseProjectStore} from '../../ProjectStateProvider';
import {FC, useState} from 'react';
import TableCard from './TableCard';

// const FileTableDropzone = dynamic(() => import('./FileTableDropzone'), {
//   ssr: false,
// });

const TablesListPanel: FC = () => {
  // const theme = useTheme();

  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);

  const tables = useBaseProjectStore((state) => state.tables);
  const tableRowCounts = useBaseProjectStore((state) => state.tableRowCounts);

  // const sqlEditor = useDisclosure();

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
    // <Flex flexDir="column" flexGrow={1} gap={3}>
    // <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.DATA_TABLES} />
    <>
      <div className="flex gap-2 flex-col flex-grow items-stretch relative">
        {/* <Flex
          flexDir="column"
          position={'absolute'}
          width={'100%'}
          height={'100%'}
          overflow={'auto'}
        > */}
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
        {/* </Flex> */}
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

export default TablesListPanel;
