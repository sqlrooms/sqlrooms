import {DownloadIcon, TriangleDownIcon, TriangleUpIcon} from '@chakra-ui/icons';
import {
  Badge,
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Input,
  Select,
  Spacer,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  keyframes,
} from '@chakra-ui/react';
import {formatCount} from '@flowmapcity/utils';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid';
import {
  ColumnDef,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {useEffect, useMemo, useState} from 'react';
import {ArrowColumnMeta} from './useArrowDataTable';

export type DataTablePaginatedProps<Data extends object> = {
  data?: ArrayLike<Data> | undefined;
  columns?: ColumnDef<Data, any>[] | undefined;
  pageCount?: number | undefined;
  numRows?: number | undefined;
  isFetching?: boolean;
  isExporting?: boolean;
  // error?: any;
  pagination?: PaginationState;
  sorting?: SortingState;
  onPaginationChange?: (pagination: PaginationState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onExport?: () => void;
};

const fetchingKeyframes = keyframes`
  0% { opacity: 0; }
  50% { opacity: 0.75; }
  100% { opacity: 0; }
`;
const fetchingAnimation = `${fetchingKeyframes} 2s linear infinite`;

export default function DataTablePaginated<Data extends object>({
  data,
  columns,
  pageCount,
  numRows,
  pagination,
  sorting,
  onPaginationChange,
  onSortingChange,
  onExport,
  isExporting,
  isFetching,
}: // error,
DataTablePaginatedProps<Data>) {
  const defaultData = useMemo(() => [], []);
  const table = useReactTable({
    data: (data ?? defaultData) as any[],
    columns: columns ?? [],
    pageCount: pageCount ?? -1,
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: (update) => {
      if (onSortingChange && sorting && typeof update === 'function') {
        onSortingChange(update(sorting));
      }
    },
    onPaginationChange: (update) => {
      if (onPaginationChange && pagination && typeof update === 'function') {
        onPaginationChange(update(pagination));
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    // getPaginationRowModel: getPaginationRowModel(), // If only doing manual pagination, you don't need this
    // debugTable: true,
    state: {
      pagination,
      sorting,
    },
  });

  const [internalPageIndex, setInternalPageIndex] = useState(
    pagination?.pageIndex ?? 0,
  );
  useEffect(() => {
    setInternalPageIndex(pagination?.pageIndex ?? 0);
  }, [pagination?.pageIndex]);

  return (
    <Flex width="100%" height="100%" position="relative">
      <TableContainer
        overflowY="auto"
        width="100%"
        height="100%"
        display="flex"
        flexDirection="column"
        py={0}
        fontFamily="mono"
        border="1px solid"
        borderColor="gray.900"
      >
        <Table size="sm">
          <Thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Tr key={headerGroup.id}>
                <Th
                  width="auto"
                  bg="gray.800"
                  borderRight="1px solid"
                  borderColor="gray.900"
                  position="sticky"
                  textAlign="center"
                  top={0}
                  zIndex={2}
                >
                  {isFetching ? <Spinner size="sm" mt="1" /> : null}
                </Th>
                {headerGroup.headers.map((header) => {
                  // see https://tanstack.com/table/v8/docs/api/core/column-def#meta to type this correctly
                  const meta = header.column.columnDef.meta as ArrowColumnMeta;
                  return (
                    <Th
                      width="auto"
                      key={header.id}
                      colSpan={header.colSpan}
                      isNumeric={meta?.isNumeric}
                      whiteSpace="nowrap"
                      cursor="pointer"
                      position="sticky"
                      top={0}
                      py={2}
                      bg="gray.800"
                      borderRight="1px solid"
                      borderColor="gray.900"
                      textTransform="unset"
                      zIndex={2}
                      onClick={header.column.getToggleSortingHandler()}
                      _hover={{bg: 'gray.600', color: 'white'}}
                    >
                      <Flex gap={2} alignItems="center">
                        {header.isPlaceholder ? null : (
                          <div>
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                          </div>
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
                          maxWidth={'70px'}
                          textOverflow="ellipsis"
                          overflow="hidden"
                        >{`${meta?.type}`}</Badge>
                      </Flex>
                    </Th>
                  );
                })}
                <Th
                  bg="gray.800"
                  borderRight="1px solid"
                  borderColor="gray.900"
                  width="100%"
                  position="sticky"
                  top={0}
                />
              </Tr>
            ))}
          </Thead>
          <Tbody>
            {table.getRowModel().rows.map((row, i) => {
              return (
                <Tr key={row.id} bg={'gray.700'} _hover={{bg: 'gray.600'}}>
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
                    {pagination
                      ? `${pagination.pageIndex * pagination.pageSize + i + 1}`
                      : ''}
                  </Td>
                  {row.getVisibleCells().map((cell) => {
                    // see https://tanstack.com/table/v8/docs/api/core/column-def#meta to type this correctly
                    const meta: any = cell.column.columnDef.meta;
                    return (
                      <Td
                        key={cell.id}
                        isNumeric={meta?.isNumeric}
                        fontSize="11px"
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
                  <Td borderRight="1px solid" borderColor="gray.900" left={0}>
                    &nbsp;
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
        <Spacer />
        <Flex
          gap={2}
          alignItems="center"
          justifyItems="center"
          position="sticky"
          bottom={0}
          left={0}
          bg="gray.800"
          py={2}
          px={2}
          flexWrap="wrap"
          // justifyContent="flex-end"
        >
          {/*<Flex gap={1} alignItems="center">*/}
          {/*  | Go to page:*/}
          {/*  <input*/}
          {/*    type="number"*/}
          {/*    defaultValue={table.getState().pagination.pageIndex + 1}*/}
          {/*    onChange={(e) => {*/}
          {/*      const page = e.target.value ? Number(e.target.value) - 1 : 0;*/}
          {/*      table.setPageIndex(page);*/}
          {/*    }}*/}
          {/*    className="border p-1 rounded w-16"*/}
          {/*  />*/}
          {/*</Flex>*/}
          <IconButton
            size="xs"
            aria-label="First page"
            icon={<ChevronDoubleLeftIcon height={16} />}
            onClick={() => table.setPageIndex(0)}
            isDisabled={!table.getCanPreviousPage()}
          />
          <IconButton
            aria-label="Previous page"
            icon={<ChevronLeftIcon height={16} />}
            size="xs"
            onClick={() => table.previousPage()}
            isDisabled={!table.getCanPreviousPage()}
          />
          <Flex alignItems="center" color="white" fontSize="xs" ml={1} gap={1}>
            <Box>Page</Box>
            <Box>
              <Input
                width="40px"
                size="xs"
                type="number"
                value={internalPageIndex + 1}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    const page = Math.max(
                      0,
                      Math.min(table.getPageCount() - 1, Number(value) - 1),
                    );
                    setInternalPageIndex(page);
                  }
                }}
                onBlur={() => {
                  if (internalPageIndex !== pagination?.pageIndex) {
                    table.setPageIndex(internalPageIndex);
                  }
                }}
              />
            </Box>
            <Box>{`of ${formatCount(table.getPageCount())}`}</Box>
          </Flex>
          <IconButton
            size="xs"
            aria-label="Next page"
            icon={<ChevronRightIcon height={16} />}
            onClick={() => table.nextPage()}
            isDisabled={!table.getCanNextPage()}
          />
          <IconButton
            size="xs"
            aria-label="Last page"
            icon={<ChevronDoubleRightIcon height={16} />}
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            isDisabled={!table.getCanNextPage()}
          />
          <Box>
            <Select
              size="xs"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
            >
              {[10, 50, 100, 500, 1000].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {`${pageSize} rows`}
                </option>
              ))}
            </Select>
          </Box>
          {/* {isFetching ? <Spinner size="sm" mt={2} /> : null} */}

          <Spacer />
          {numRows !== undefined && isFinite(numRows) ? (
            <Box color="white" fontWeight="normal" fontSize="xs">
              {`${formatCount(numRows)} rows`}
            </Box>
          ) : null}

          {onExport ? (
            <Button
              isLoading={isExporting}
              size={'xs'}
              leftIcon={<Icon as={DownloadIcon} h={5} w={5} />}
              onClick={onExport}
            >
              Export CSV
            </Button>
          ) : null}
        </Flex>
      </TableContainer>
      {/* {error ? (
        <ErrorPane
          zIndex={3}
          width="100%"
          height="100%"
          bg="gray.700"
          position="absolute"
          top="0"
          left="0"
          // text={
          //   error instanceof DuckQueryError
          //     ? error.getMessageForUser()
          //     : undefined
          // }
        />
      ) : null} */}
      {isFetching ? (
        <Box
          bg="gray.800"
          opacity="0.8"
          zIndex="3"
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          animation={fetchingAnimation}
        />
      ) : // <SpinnerPane
      //   bg="gray.800"
      //   opacity="0.5"
      //   zIndex="3"
      //   position="absolute"
      //   top={0}
      //   left={0}
      //   width="100%"
      //   height="100%"
      // />
      null}
    </Flex>
  );
}
