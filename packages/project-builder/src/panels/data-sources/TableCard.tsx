import {
  Badge,
  Box,
  Flex,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Thead,
  Tr,
} from '@chakra-ui/react';
import {DataTable} from '@sqlrooms/duckdb';
import {formatNumber} from '@sqlrooms/utils';
import {FC} from 'react';

export type Props = {
  isReadOnly?: boolean;
  value?: DataTable;
  rowCount?: number;
  onReset?: () => void;
  onClick?: () => void;
};

const TableCard: FC<Props> = (props) => {
  const {isReadOnly, value, rowCount, onReset, onClick} = props;
  if (!value) return null;

  return (
    <Flex
      border={`1px solid`}
      borderColor="gray.600"
      bg={'gray.800'}
      alignSelf={`stretch`}
      borderRadius="sm"
      py={2}
      px={2}
      alignItems="center"
      justifyContent="center"
      position={`relative`}
      cursor="pointer"
      onClick={onClick}
      transition={'border-color 0.2s ease-in-out'}
      _hover={{borderColor: 'gray.100'}}
    >
      {/* <Box position="absolute" top={1} right={2}>
        <Menu placement={'bottom-end'}>
          <MenuButton
            mt={'6px'}
            size="xs"
            as={IconButton}
            aria-label="Options"
            icon={<EllipsisHorizontalIcon width="18px" />}
            variant="ghost"
            color={'gray.400'}
          />
          <Portal>
            <MenuList>
              <MenuItem
                isDisabled={true}
                fontSize={'sm'}
                icon={<TableCellsIcon width="15px" />}
              >
                View data
              </MenuItem>

              {!isReadOnly ? (
                <>
                  <MenuItem
                    isDisabled={true}
                    fontSize={'sm'}
                    icon={<PencilIcon width="15px" />}
                  >
                    Rename table
                  </MenuItem>
                  <MenuItem
                    isDisabled={true}
                    fontSize={'sm'}
                    icon={<TrashIcon width="15px" />}
                    // onClick={deleteDatasetModal.onOpen}
                  >
                    Delete table
                  </MenuItem>
                  <MenuItem
                    fontSize={'sm'}
                    icon={<ArrowDownTrayIcon width="15px" />}
                    onClick={console.log}
                    isDisabled
                  >
                    Download
                  </MenuItem>
                </>
              ) : null}
            </MenuList>
          </Portal>
        </Menu>
      </Box> */}

      <Flex gap={2} px={2} mt={0} direction={'column'} width={'100%'}>
        <Box overflow={'auto'}>
          <Table size="xs">
            <Thead>
              <Tr>
                <Td pr={6}>
                  <Box
                    height={'30px'}
                    overflow={'hidden'}
                    position={'relative'}
                  >
                    <Box
                      fontSize="sm"
                      fontWeight={'bold'}
                      position={'absolute'}
                      width={'100%'}
                      color={'gray.100'}
                      mb={1}
                      py={1}
                      // fontFamily={"monospace"}
                      // maxWidth="230px"
                      whiteSpace={'nowrap'}
                      textOverflow={'ellipsis'}
                      overflow={'hidden'}
                      // textTransform={'lowercase'}
                    >
                      {value.tableName}
                    </Box>
                  </Box>
                </Td>
              </Tr>
            </Thead>
            <Tbody>
              {value.columns?.map((row, i) => {
                return (
                  <Tr key={i}>
                    <Td>
                      <HStack>
                        <Box width="60px">
                          <Badge
                            colorScheme="blue"
                            opacity="0.5"
                            fontSize={'xx-small'}
                            variant="outline"
                          >
                            {row.type}
                          </Badge>
                        </Box>
                        <Flex
                          color="gray.300"
                          fontSize={'x-small'}
                          maxWidth={'100px'}
                        >
                          {row.name}
                        </Flex>
                      </HStack>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          <Text fontSize="xs" textAlign={'right'} mt={1}>
            {`${formatNumber(value.rowCount ?? rowCount ?? NaN)} rows`}
          </Text>
        </Box>
      </Flex>
    </Flex>
  );
};

export default TableCard;
