import {
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Text,
} from '@chakra-ui/react';
import {shorten} from '@flowmapcity/utils';
import {ClipboardIcon} from '@heroicons/react/24/outline';
import {createColumnHelper} from '@tanstack/react-table';
import {ColumnDef} from '@tanstack/table-core';
import * as arrow from 'apache-arrow';
import {useMemo} from 'react';

const columnHelper = createColumnHelper();

// TODO: support fetch the result chunks lazily https://github.com/duckdb/duckdb-wasm/tree/master/packages/duckdb-wasm#query-execution

type UseArrowDataTableResult = {
  data: ArrayLike<any>;
  columns: ColumnDef<any, any>[];
};

export type ArrowColumnMeta = {
  type: arrow.DataType;
  isNumeric: boolean;
};

const MAX_VALUE_LENGTH = 64;

// Only use for small tables or in combination with pagination
export default function useArrowDataTable(
  table: arrow.Table | undefined,
): UseArrowDataTableResult | undefined {
  const data = useMemo(() => ({length: table?.numRows ?? 0}), [table]);
  const columns = useMemo(() => {
    if (!table) return undefined;
    const columns: ColumnDef<any, any>[] = [];
    for (const field of table.schema.fields) {
      columns.push(
        columnHelper.accessor((row, i) => table.getChild(field.name)?.get(i), {
          cell: (info) => {
            const value = info.getValue();
            const valueStr = arrow.DataType.isTimestamp(field.type)
              ? new Date(value).toISOString()
              : String(value);

            return valueStr.length > MAX_VALUE_LENGTH ? (
              <Popover trigger="hover">
                <PopoverTrigger>
                  <Text>{shorten(`${valueStr}`, MAX_VALUE_LENGTH)}</Text>
                </PopoverTrigger>
                <Portal>
                  <PopoverContent
                    fontFamily="mono"
                    bg={'gray.600'}
                    fontSize="xs"
                  >
                    <PopoverArrow bg={'gray.600'} />
                    <PopoverCloseButton />
                    <PopoverHeader>{`"${field.name}" (${field.type})`}</PopoverHeader>
                    <PopoverBody position="relative">
                      {valueStr}
                      <IconButton
                        position="absolute"
                        top="1"
                        right="1"
                        variant="ghost"
                        color="gray.100"
                        aria-label={'Copy value'}
                        size="xs"
                        p="0"
                        onClick={() => {
                          navigator.clipboard.writeText(valueStr);
                        }}
                        icon={<ClipboardIcon width="13px" height="13px" />}
                      />
                    </PopoverBody>
                  </PopoverContent>
                </Portal>
              </Popover>
            ) : (
              valueStr
            );
          },
          header: field.name,
          meta: {
            type: field.type,
            isNumeric:
              arrow.DataType.isFloat(field.type) ||
              arrow.DataType.isDecimal(field.type) ||
              arrow.DataType.isInt(field.type),
          },
        }),
      );
    }
    return columns;
  }, [table]);

  return data && columns ? {data, columns} : undefined;
}
