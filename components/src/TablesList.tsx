import {Button, Flex, List, ListItem, useToast} from '@chakra-ui/react';
import {useDuckConn} from '@flowmapcity/duckdb';
import {TableCellsIcon} from '@heroicons/react/24/solid';
import {FC, useCallback} from 'react';
type Props = {
  schema: string;
  tableNames: string[];
  selectedTable?: string;
  onSelect: (name: string) => void;
  onChange?: () => void;
  renderTableButton?: (
    tableName: string,
    onSelect: Props['onSelect'],
  ) => JSX.Element;
};
const TablesList: FC<Props> = (props) => {
  const {
    schema = 'main',
    tableNames,
    selectedTable,
    onSelect,
    onChange,
    renderTableButton = (tableName: string, onSelect: Props['onSelect']) => (
      <Button
        width="100%"
        bg={selectedTable === tableName ? 'gray.600' : undefined}
        leftIcon={<TableCellsIcon width={16} height={16} />}
        justifyContent="flex-start"
        colorScheme="cyan"
        variant="ghost"
        size="sm"
        fontWeight="normal"
        onClick={() => onSelect(tableName)}
        overflow="hidden"
        whiteSpace="normal"
        height="auto"
        minHeight="25px"
        fontSize="sm"
        textAlign="left"
        overflowWrap="anywhere"
      >
        {tableName}
      </Button>
    ),
  } = props;
  const {conn} = useDuckConn();

  const toast = useToast();
  const onError = useCallback(
    (message: string) => {
      toast.closeAll();
      toast({
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },
    [toast],
  );

  const handleDeleteTable = useCallback(
    async (table: string) => {
      if (!conn) return;
      const confirm = window.confirm(
        `Are you sure you want to delete table "${table}"?`,
      );
      if (!confirm) return;
      try {
        await conn.query(`DROP VIEW ${schema}.${table}`);
        onChange?.();
      } catch (e) {
        onError(`Error deleting table "${table}"`);
      }
    },
    [conn, schema, onChange, onError],
  );

  return (
    <Flex height="100%" bg="gray.800" px="2" py="4">
      <List spacing={1}>
        {tableNames.map((tableName, i) => (
          <ListItem key={i}>
            <Flex alignItems="center" gap="1">
              {renderTableButton(tableName, onSelect)}

              {/* <Flex minWidth="25px">
              {selectedTable === tableName ? (
                <Menu placement={'bottom-start'}>
                  <MenuButton
                    size="xs"
                    as={IconButton}
                    aria-label="Options"
                    icon={<Cog8ToothIcon width="15px" />}
                    variant="ghost"
                    color={'gray.400'}
                    // onClick={() => onSelect(tableName)}
                  />

                  <MenuList minWidth="120px">
                    <MenuItem
                      isDisabled={true}
                      fontSize={'sm'}
                      icon={<PencilIcon width="15px" />}
                    >
                      Rename
                    </MenuItem>
                    <MenuItem
                      isDisabled={true}
                      fontSize={'sm'}
                      icon={<TrashIcon width="15px" />}
                      onClick={() => handleDeleteTable(tableName)}
                    >
                      Delete
                    </MenuItem>
                  </MenuList>
                </Menu>
              ) : null}
            </Flex> */}
            </Flex>
          </ListItem>
        ))}
      </List>
    </Flex>
  );
};

export default TablesList;
