import {
  Badge,
  Box,
  Flex,
  FlexProps,
  HStack,
  Button,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
  Switch,
} from '@chakra-ui/react';
import { DataTable } from '@sqlrooms/duckdb';
import { formatNumber } from '@sqlrooms/utils';
import { FC } from 'react';

export type Props = {
  isReadOnly?: boolean;
  value?: DataTable;
  rowCount?: number;
  onReset?: () => void;
  onClick?: () => void;
  showSwitches?: boolean;
  selectedColumns?: Record<string, string>;
  onColumnToggle?: (columnName: string, isSelected: boolean) => void;
} & FlexProps;

const TableCard: FC<Props> = ({ 
  isReadOnly, 
  value, 
  rowCount, 
  onReset, 
  showSwitches = false, 
  onClick, 
  selectedColumns = {}, 
  onColumnToggle,
  ...rest 
}) => {
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
      maxHeight={'400px'}
      overflow="hidden"
      alignItems="center"
      justifyContent="center"
      position={`relative`}
      transition={'border-color 0.2s ease-in-out'}
      _hover={{ borderColor: 'gray.100' }}
      {...rest}
    >
      <Flex px={2} mt={0} direction={'column'} width={'100%'} height="100%">
        <Flex 
          width={'100%'}
          pb={1}
          justifyContent={'space-between'}
          borderBottom={'0.5px solid'}
          borderColor={'gray.700'}
          gap={2}
        >
          <Text
            flex={1}
            minW={0}
            fontSize="sm"
            fontWeight="bold"
            color="gray.100"
            py={1}
            isTruncated
          >
            {value.tableName}
          </Text>
          <Flex>
            <Button
              size="xs"
              borderRadius="sm"
              colorScheme={'blue'}
              onClick={onClick}
            >
              View data
             </Button>
          </Flex>
        </Flex>
        <Box flex={1} overflowY="auto">
          <Table size="xs" width="100%" sx={{ tableLayout: 'fixed' }}>
            <Tbody>
              {value.columns?.map((row, i) => {
                const isSelected = Object.values(selectedColumns).includes(row.name);
                return (
                  <Tr key={i}>
                    <Td overflow="hidden">
                      <HStack justifyContent={'space-between'}>
                        <HStack cursor={'pointer'} alignItems={'center'} as="label" htmlFor={`${row.name}-switch`} flex={1} minW={0} gap={2}>
                        <Flex>
                          <Badge
                            my={1}
                            width='70px'
                            colorScheme="blue"
                            opacity="0.5"
                            fontSize={'x-small'}
                            variant="outline"
                            overflow='hidden'
                            textAlign="center"
                          >
                            {row.type}
                          </Badge>
                        </Flex>
                        <Text
                          color="gray.300"
                          fontSize="11px"
                          flex={1}
                          minW={0}
                          isTruncated
                        >
                          {row.name}
                        </Text>
                        </HStack>
                        {showSwitches && <Switch
                          id={`${row.name}-switch`}
                          size="sm"
                          transform={'scale(0.8)'}
                          colorScheme="blue"
                          isChecked={isSelected}
                          onChange={(e) => {
                            if (onColumnToggle) {
                              onColumnToggle(row.name, e.target.checked);
                            }
                          }}
                        />}
                      </HStack>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
        <Text fontSize="2xs" textAlign={'right'} mt={1}>
          {`${formatNumber(value.rowCount ?? rowCount ?? NaN)} rows`}
        </Text>
      </Flex>
    </Flex>
  );
};

export default TableCard;
