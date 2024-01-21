import {
  Alert,
  AlertIcon,
  Button,
  Flex,
  Heading,
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Spacer,
  Text,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import {AppContext} from '@flowmapcity/components';
import {
  DataTable,
  DuckQueryError,
  escapeId,
  getAttributeColumnType,
} from '@flowmapcity/duckdb';
import {AttributeType, ColumnMapping} from '@flowmapcity/project-config';
import {
  convertToUniqueColumnOrTableName,
  formatNumber,
} from '@flowmapcity/utils';
import {CodeBracketIcon} from '@heroicons/react/24/outline';
import {ChevronDownIcon, PlusIcon} from '@heroicons/react/24/solid';
import {Select} from 'chakra-react-select';
import {produce} from 'immer';
import {FC, useContext, useMemo} from 'react';
import {BsMagic} from 'react-icons/bs';
import {useProjectStore} from '../ProjectStateProvider';
import {ColumnMappingValidationResult, ColumnSpec} from '../types';
import AttributesColumnConfigurator from './AttributesColumnConfigurator';
import autoSelectColumns from './autoSelectColumns';
import ColumnMappingConfigurator from './ColumnMappingConfigurator';
import {InputColumnOption} from './FieldSelect';
import SuggestedFixModal from './SuggestedFixModal';
import TableFieldLabel from './TableFieldLabel';

type Props = {
  isReadOnly?: boolean;
  columnMapping?: ColumnMapping;
  onChange: (columnMapping: ColumnMapping | undefined) => void;
  outputColumnSpecs: ColumnSpec[];
  allowCustomColumns?: boolean;
  validationResult?: ColumnMappingValidationResult;
};

const ColumnMappingPanel: FC<Props> = (props) => {
  const {
    isReadOnly,
    validationResult,
    columnMapping,
    outputColumnSpecs,
    allowCustomColumns,
    onChange,
  } = props;

  const tables = useProjectStore((state) => state.tables);
  const tableRowCounts = useProjectStore((state) => state.tableRowCounts);

  const getTable = useProjectStore((state) => state.getTable);
  const tableName = columnMapping?.tableName;
  const dataTable = tableName ? getTable(tableName) : undefined;

  const selectedTable = useMemo(
    () => tables.find((t) => t.tableName === dataTable?.tableName),
    [tables, dataTable?.tableName],
  );

  const inputTableColumns: Array<InputColumnOption> = useMemo(() => {
    if (!dataTable?.columns) return [];
    return dataTable.columns.map((row: any) => ({
      value: row.name,
      row: row,
    }));
  }, [dataTable?.columns]);

  const usedOutputColNames = useMemo(() => {
    return Object.keys(columnMapping?.columns || {}).concat(
      columnMapping?.attributes?.map((d) => d.column) || [],
    );
  }, [columnMapping?.attributes, columnMapping?.columns]);

  const unusedInputColumns: Array<InputColumnOption> = useMemo(() => {
    if (!dataTable?.columns) return [];
    const usedCols = Object.values(columnMapping?.columns || {}).concat(
      columnMapping?.attributes?.map((d) => d.expression) || [],
    );
    return inputTableColumns.filter(
      (col) => !usedCols.includes((col as InputColumnOption).value),
    );
  }, [
    dataTable?.columns,
    columnMapping?.columns,
    columnMapping?.attributes,
    inputTableColumns,
  ]);

  const handleSelectTable = (table: DataTable | null) => {
    if (!table) {
      onChange(undefined);
      return;
    }
    const nextResult: ColumnMapping = autoSelectColumns(
      table,
      outputColumnSpecs,
      {tableName: table.tableName, columns: {}, attributes: []},
    );
    onChange(nextResult);
  };
  const {captureException} = useContext(AppContext);
  const toast = useToast();
  const handleAddAttribute = async (columnName: string) => {
    if (!columnMapping?.tableName || !unusedInputColumns.length) return;

    let type: AttributeType | undefined;
    try {
      type = await getAttributeColumnType(
        columnMapping.tableName,
        escapeId(columnName),
      );
    } catch (err) {
      toast({
        title: `Could not add attribute`,
        description:
          err instanceof DuckQueryError ? err.getMessageForUser() : `${err}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
      console.error(err);
      captureException(err);
      return;
    }

    onChange(
      produce(columnMapping, (draft) => {
        if (!draft.attributes) draft.attributes = [];
        // TODO:
        const newColName = convertToUniqueColumnOrTableName(
          columnName,
          usedOutputColNames,
        );
        draft.attributes.push({
          label: columnName,
          column: newColName,
          expression: escapeId(columnName),
          type,
        });
      }),
    );
  };

  const handleSelectAttribute = (
    column: string,
    inputColumn: string | undefined,
  ) => {
    if (!columnMapping) return;
    if (!dataTable) return;
    const nextResult = produce(columnMapping, (draft) => {
      if (inputColumn) {
        draft.columns[column] = inputColumn;
        // remove selected prop from custom columns
        draft.attributes = draft.attributes?.filter(
          (d) => d.expression !== inputColumn,
        );
      } else {
        delete draft.columns[column];
      }
    });
    onChange(nextResult);
  };

  const handleAttrsChange = (attributes?: ColumnMapping['attributes']) => {
    if (!columnMapping) return;
    const nextResult = produce(columnMapping, (draft) => {
      draft.attributes = attributes;
    });
    onChange(nextResult);
  };

  const suggestedFixModal = useDisclosure();
  const appContext = useContext(AppContext);

  return (
    <Flex flexDir="column" height="100%" gap={2} pb={5}>
      <Select<DataTable>
        name="tables"
        isDisabled={isReadOnly}
        placeholder="Select table…"
        value={tables.find((t) => t === selectedTable)}
        options={tables}
        size="sm"
        closeMenuOnSelect={true}
        menuPlacement="auto"
        menuPortalTarget={
          appContext.mode !== 'sdk' ? appContext.portalRef?.current : undefined
        }
        isMulti={false}
        isSearchable={true}
        isClearable={true}
        getOptionValue={(table) => table.tableName}
        getOptionLabel={(table) => table.tableName}
        onChange={handleSelectTable}
        formatOptionLabel={(table, {context}) => {
          const rowCount = tableRowCounts[table.tableName];
          return context === 'value' ? (
            <Text fontSize="sm">{table.tableName}</Text>
          ) : (
            <Flex direction="row" width="100%" alignItems="center">
              <Text fontSize="sm" maxWidth="80%">
                {table.tableName}
              </Text>
              <Spacer />
              <Text color={'gray.500'} fontSize={'xs'} textAlign="right">
                {rowCount !== undefined ? `${formatNumber(rowCount)} rows` : ''}
              </Text>
            </Flex>
          );
        }}
      />

      <Flex
        // minHeight={'32px'}
        alignItems="center"
        flexDir="column"
        gap="1"
      >
        {validationResult ? (
          <>
            <Alert
              status={validationResult.status ?? 'info'}
              fontSize="xs"
              p={0}
              bg="transparent"
              justifyContent="center"
            >
              <AlertIcon />
              <Text>{validationResult.message}</Text>
            </Alert>
            {validationResult.suggestedFix && (
              <Button
                ml={2}
                display="inline"
                size="xs"
                variant="solid"
                onClick={suggestedFixModal.onOpen}
                colorScheme="blue"
                leftIcon={<BsMagic width={16} height={16} />}
              >
                Fix this issue
              </Button>
            )}
          </>
        ) : null}
      </Flex>

      {dataTable ? (
        <Flex
          direction="column"
          alignItems="center"
          overflowX="hidden"
          overflowY="auto"
          p={0}
          mt={4}
          cursor="pointer"
          bg="transparent"
          // _hover={{bg: value?.inputTableFields ? undefined : activeBg}}
          transition="background-color 0.2s ease"
          // borderRadius={8}
          // border={`2px ${value?.inputRowCount ? 'solid' : 'dashed'}`}
          // borderColor={borderColor}
          position="relative"
          height="100%"
          // onClick={handleClick}
        >
          <VStack gap="2" alignItems="flex-start">
            <Heading fontSize="xs" textTransform="uppercase" color="gray.400">
              Column mapping
            </Heading>

            <Flex color="gray.400" gap="5" flexDir="column">
              <ColumnMappingConfigurator
                isReadOnly={isReadOnly}
                inputTableColumns={inputTableColumns}
                outputColumnSpecs={outputColumnSpecs}
                unusedInputColumns={unusedInputColumns}
                columns={columnMapping?.columns}
                onSelect={handleSelectAttribute}
              />
              {allowCustomColumns && columnMapping?.tableName ? (
                <>
                  <Flex flexDir="column" gap="3" mt="3">
                    {/*<Heading
                      fontSize="xs"
                      textTransform="uppercase"
                      color="gray.400"
                    >
                      Additional Columns
                    </Heading>
                     <Text fontSize="xs">
                      Add more columns to use as attributes
                    </Text> */}

                    {!isReadOnly ? (
                      <Menu placement="bottom-end">
                        <MenuButton
                          as={Button}
                          size="sm"
                          variant="solid"
                          color="white"
                          rightIcon={<ChevronDownIcon width={15} height={15} />}
                          // isDisabled={!unusedInputColumns.length}
                        >
                          <Flex justifyContent="center">
                            <HStack>
                              <PlusIcon width={15} height={15} />
                              <Text>Add column</Text>
                            </HStack>
                          </Flex>
                        </MenuButton>
                        <Portal>
                          <MenuList>
                            {unusedInputColumns.map((column) => (
                              <MenuItem
                                fontSize="sm"
                                key={column.value}
                                color="white"
                                onClick={() => handleAddAttribute(column.value)}
                              >
                                <TableFieldLabel
                                  field={column.row}
                                  showTypeBadge
                                />
                              </MenuItem>
                            ))}
                            <MenuItem
                              icon={<CodeBracketIcon width="16px" />}
                              fontSize="sm"
                              color="white"
                              isDisabled={true}
                            >
                              SQL expression
                            </MenuItem>
                          </MenuList>
                        </Portal>
                      </Menu>
                    ) : null}
                  </Flex>
                  <AttributesColumnConfigurator
                    isReadOnly={isReadOnly}
                    inputTableColumns={inputTableColumns}
                    usedOutputColNames={usedOutputColNames}
                    attributes={columnMapping?.attributes}
                    onChange={handleAttrsChange}
                  />
                </>
              ) : null}
            </Flex>
          </VStack>
        </Flex>
      ) : null}

      {validationResult?.suggestedFix ? (
        <SuggestedFixModal
          disclosure={suggestedFixModal}
          problemDescription={validationResult.message}
          suggestedFix={validationResult.suggestedFix}
          // onApplySuggestedFix={onChange}
        />
      ) : null}
    </Flex>
  );
};

export default ColumnMappingPanel;
