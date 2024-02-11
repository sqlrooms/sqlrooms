import {Flex, useDisclosure, VStack} from '@chakra-ui/react';
import {DataTableModal} from '@sqlrooms/data-table';
import {DataTable} from '@sqlrooms/duckdb';
import {useBaseProjectStore} from '@sqlrooms/project-builder';
import {FC, useState} from 'react';
import TableCard from './TableCard';

// const FileTableDropzone = dynamic(() => import('./FileTableDropzone'), {
//   ssr: false,
// });

type Props = {
  // ...
};

const TablesListPanel: FC<Props> = (props) => {
  // const theme = useTheme();
  const {} = props;
  const isReadOnly = useBaseProjectStore((state) => state.isReadOnly);

  const tables = useBaseProjectStore((state) => state.tables);
  const tableRowCounts = useBaseProjectStore((state) => state.tableRowCounts);

  // const sqlEditor = useDisclosure();

  const [selectedTable, setSelectedTable] = useState<DataTable | undefined>(
    undefined,
  );
  const tableModal = useDisclosure();
  const handleClick = (table: DataTable) => {
    tableModal.onOpen();
    setSelectedTable(table);
  };

  return (
    // <Flex flexDir="column" flexGrow={1} gap={3}>
    // <ProjectBuilderPanelHeader panelKey={ProjectPanelTypes.DATA_TABLES} />
    <>
      <Flex
        gap={2}
        direction={'column'}
        //height={'100%'}
        flexGrow={1}
        alignItems={'stretch'}
        //overflow="auto"
        position="relative"
      >
        {/* <Flex
          flexDir="column"
          position={'absolute'}
          width={'100%'}
          height={'100%'}
          overflow={'auto'}
        > */}
        {tables?.length ? (
          <VStack gap={2}>
            {tables.map((table, i) => (
              <TableCard
                key={i}
                onClick={() => handleClick(table)}
                isReadOnly={isReadOnly}
                value={table}
                rowCount={tableRowCounts[table.tableName]}
              />
            ))}
          </VStack>
        ) : null}
        {/* </Flex> */}
      </Flex>

      <DataTableModal
        tableModal={tableModal}
        title={selectedTable?.tableName}
        query={`SELECT * FROM ${selectedTable?.tableName}`}
      />
    </>
  );
};

export default TablesListPanel;
