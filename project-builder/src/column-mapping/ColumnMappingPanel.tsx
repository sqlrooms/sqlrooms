import {
  Alert,
  AlertIcon,
  Button,
  Flex,
  Heading,
  Spacer,
  Text,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import {AppContext} from '@flowmapcity/components';
import {DataTable} from '@flowmapcity/duckdb';
import {ColumnMapping} from '@flowmapcity/project-config';
import {formatNumber} from '@flowmapcity/utils';
import {PlusIcon} from '@heroicons/react/24/solid';
import {Select} from 'chakra-react-select';
import {produce} from 'immer';
import {FC, useContext, useMemo} from 'react';
import {BsMagic} from 'react-icons/bs';
import {MdOutlineSplitscreen} from 'react-icons/md';
import {useProjectStore} from '../ProjectStateProvider';
import {ColumnMappingValidationResult, ColumnSpec} from '../types';
import AttributesColumnConfigurator from './AttributesColumnConfigurator';
import ColumnMappingConfigurator from './ColumnMappingConfigurator';
import {InputColumnOption} from './FieldSelect';
import SuggestedFixModal from './SuggestedFixModal';
import autoSelectColumns from './autoSelectColumns';

type Props = {
  columnMapping?: ColumnMapping;
  onChange: (columnMapping: ColumnMapping | undefined) => void;
  outputColumnSpecs: ColumnSpec[];
  allowCustomColumns?: boolean;
  validationResult?: ColumnMappingValidationResult;
};

const ColumnMappingPanel: FC<Props> = (props) => {
  const {
    validationResult,
    columnMapping,
    outputColumnSpecs,
    allowCustomColumns,
    onChange,
  } = props;

  const isReadOnly = useProjectStore((state) => state.isReadOnly);
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
    return Object.keys(columnMapping?.columns || {})
      .concat(columnMapping?.attributes?.map((d) => d.column) || [])
      .concat(columnMapping?.partitionBy?.map((d) => d.column) || []);
  }, [
    columnMapping?.attributes,
    columnMapping?.columns,
    columnMapping?.partitionBy,
  ]);

  const unusedInputColumns: Array<InputColumnOption> = useMemo(() => {
    if (!dataTable?.columns) return [];
    return inputTableColumns.filter(
      (col) => !usedOutputColNames.includes((col as InputColumnOption).value),
    );
  }, [dataTable?.columns, inputTableColumns, usedOutputColNames]);

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
                <Flex flexDir="column" gap="8" mt="3" pb="1">
                  <AttributesColumnConfigurator
                    mode="attributes"
                    columnMapping={columnMapping}
                    title="Additional columns"
                    helpText={`Add more columns to the resulting flows table to
                          enable filtering and grouping by them.`}
                    buttonLabel="Add columns"
                    buttonIcon={<PlusIcon width={15} height={15} />}
                    inputTableColumns={inputTableColumns}
                    usedOutputColNames={usedOutputColNames}
                    unusedInputColumns={unusedInputColumns}
                    attributes={columnMapping?.attributes}
                    onChange={onChange}
                  />

                  <AttributesColumnConfigurator
                    mode="partitionBy"
                    columnMapping={columnMapping}
                    title="Partition by"
                    buttonLabel="Partition by"
                    helpText={`Choose columns by which to partition the dataset into multiple 
                      subsets, if you only want to look at one subset at a time.`}
                    buttonIcon={<MdOutlineSplitscreen width={15} height={15} />}
                    inputTableColumns={inputTableColumns}
                    usedOutputColNames={usedOutputColNames}
                    unusedInputColumns={unusedInputColumns}
                    attributes={columnMapping?.partitionBy}
                    onChange={onChange}
                  />
                </Flex>
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
