import { TriangleDownIcon, TriangleUpIcon } from '@chakra-ui/icons';
import {
  Badge,
  Flex,
  Spacer,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { ErrorPane, SpinnerPane } from '@sqlrooms/components';
import { formatCount } from '@sqlrooms/utils';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';
import { useVirtual } from 'react-virtual';

export type Props<Data extends object> = {
  data?: ArrayLike<Data>;
  columns?: ColumnDef<Data, any>[];
  isFetching?: boolean;
  error?: any;
  isPreview?: boolean;
};

export type DataTableProps<Data extends object> = {
  data: ArrayLike<Data>;
  columns: ColumnDef<Data, any>[];
  isPreview?: boolean;
};

const DataTableVirtualized = React.memo(function DataTableVirtualized<Data extends object>({
  data,
  columns,
  isPreview,
}: DataTableProps<Data>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    columns,
    data: data as Data[],
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtual({
    parentRef: tableContainerRef,
    size: rows.length,
    overscan: 20,
  });
  const { virtualItems: virtualRows, totalSize } = rowVirtualizer;

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

  return (
    <Flex
      overflowX="auto"
      overflowY="auto"
      display="flex"
      flexDirection="column"
      py={0}
      alignItems="flex-start"
    >
      <TableContainer
        ref={tableContainerRef}
        overflowY="auto"
        border="1px solid"
        borderColor="gray.900"
      >
        <Table
          size="sm"
          __css={{
            borderCollapse: 'separate', // to keep header borders sticky
            borderSpacing: 0,
          }}
          fontFamily="mono"
        >
          <Thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Tr key={headerGroup.id} position="sticky" top={0}>
                <Th
                  bg="gray.800"
                  borderRight="1px solid"
                  borderColor="gray.900"
                />

                {headerGroup.headers.map((header) => {
                  // see https://tanstack.com/table/v8/docs/api/core/column-def#meta to type this correctly
                  const meta: any = header.column.columnDef.meta;
                  return (
                    <Th
                      key={header.id}
                      fontFamily="mono"
                      onClick={header.column.getToggleSortingHandler()}
                      isNumeric={meta?.isNumeric}
                      whiteSpace="nowrap"
                      textTransform="unset"
                      cursor="pointer"
                      px={7}
                      py={2}
                      // borderBottom="1px solid"
                      // color="gray.800"
                      // bg="gray.100"
                      // _hover={{
                      //   color: 'white',
                      //   bg: 'gray.600',
                      // }}
                      borderRight="1px solid"
                      borderColor="gray.900"
                      color="gray.400"
                      bg="gray.800"
                      _hover={{ bg: 'gray.600' }}
                      maxWidth="500px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                    >
                      <Flex
                        alignItems="center"
                        gap={1}
                        justifyContent={
                          meta?.isNumeric ? 'flex-end' : 'flex-start'
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}

                        {header.column.getIsSorted() ? (
                          header.column.getIsSorted() === 'desc' ? (
                            <TriangleDownIcon aria-label="sorted descending" />
                          ) : (
                            <TriangleUpIcon aria-label="sorted ascending" />
                          )
                        ) : null}
                        <Spacer />
                        <Badge
                          colorScheme="blue"
                          opacity="0.3"
                          fontSize={9}
                          variant="outline"
                        >{`${meta?.type}`}</Badge>
                      </Flex>
                    </Th>
                  );
                })}
              </Tr>
            ))}
          </Thead>
          <Tbody>
            {paddingTop > 0 && (
              <Tr>
                <Td height={`${paddingTop}px`} />
              </Tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <Tr
                  key={row.id}
                  // bg={virtualRow.index % 2 ? 'gray.700' : 'gray.800'}
                  bg={'gray.700'}
                  _hover={{ bg: 'gray.600' }}
                >
                  <Td
                    fontSize="xs"
                    borderRight="1px solid"
                    borderColor="gray.900"
                    bg={'gray.800'}
                    textAlign="center"
                    color="gray.400"
                    position="sticky"
                    left={0}
                  >
                    {virtualRow.index + 1}
                  </Td>
                  {row.getVisibleCells().map((cell) => {
                    // see https://tanstack.com/table/v8/docs/api/core/column-def#meta to type this correctly
                    const meta: any = cell.column.columnDef.meta;
                    return (
                      <Td
                        key={cell.id}
                        isNumeric={meta?.isNumeric}
                        fontSize="xs"
                        color="white"
                        borderRight="1px solid"
                        borderColor="gray.900"
                        maxWidth="500px"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        px={7}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Td>
                    );
                  })}
                </Tr>
              );
            })}
            {paddingBottom > 0 && (
              <Tr>
                <Td height={`${paddingBottom}px`} />
              </Tr>
            )}
          </Tbody>
          {/* <Tfoot>
            <Tr>
              <Td
                colSpan={columns.length}
                borderTop="1px solid"
                gap={2}
                position="sticky"
                bottom={0}
                left={0}
                bg="gray.700"
                py={2}
                px={4}
                color="gray.400"
                fontWeight="bold"
                fontSize="sm"
                justifyContent="flex-start"
                borderBottom="1px solid"
              >
                {`${formatCount(data.length)} rows`}
              </Td>
            </Tr>
          </Tfoot> */}
        </Table>

        <Spacer />
        <Flex
          gap={2}
          fontFamily="mono"
          alignItems="center"
          position="sticky"
          bottom={0}
          left={0}
          py={2}
          px={4}
          fontSize="xs"
          justifyContent="flex-start"
          color="white"
          bg="gray.800"
          fontWeight="bold"
        >
          {`${isPreview ? 'Preview of the first ' : ''}${formatCount(
            data.length,
          )} rows`}
        </Flex>
      </TableContainer>
    </Flex>
  );
});

export default function DataTableWithLoader<Data extends object>(
  props: Props<Data>,
) {
  const { isPreview, isFetching, error, ...rest } = props;
  const { data, columns } = rest;
  return error ? (
    <ErrorPane error={error} />
  ) : isFetching ? (
    <SpinnerPane h="100%" />
  ) : data && columns ? (
    <DataTableVirtualized data={data} columns={columns as any} isPreview={isPreview} />
  ) : null;
}
