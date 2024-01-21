import React, {FC, useState} from 'react';
import {Text, HStack, Input, Flex, Spinner} from '@chakra-ui/react';
import {escapeId, useDuckConn} from '@flowmapcity/duckdb';
import {useQuery} from '@tanstack/react-query';
import {InputColumnOption} from './FieldSelect';
import * as arrow from 'apache-arrow';
import {AttributeColumn} from '@flowmapcity/project-config';

type Props = {
  inputTableName: string;
  attrColumn: AttributeColumn;
  countsColumnName?: string;
  columnOption: InputColumnOption;
  onChangeName: (name: string) => void;
};

const CustomColumnConfigurator: FC<Props> = (props) => {
  const {inputTableName, attrColumn, columnOption, onChangeName} = props;
  const {conn} = useDuckConn();
  const {isFetching} = useQuery(
    ['custom-column-stats', inputTableName, attrColumn],
    async () => {
      const {column} = attrColumn;
      switch (columnOption.row.type) {
        case 'TIMESTAMP':
        case 'INTEGER':
          const res = await conn.query<{
            min: arrow.Int;
            max: arrow.Int;
            nbins: arrow.Int;
          }>(`
              SELECT
                MIN(${escapeId(column)}) as min,
                MAX(${escapeId(column)}) as max,
                least(50, ceil(sqrt(count(${escapeId(column)})))) as nbins
              FROM
                 ${inputTableName}
          `);

          const {min, max, nbins} = res.get(0) ?? {};
          console.log({min, max, nbins});
          break;
        default:
          return null;
      }
    },
    {
      suspense: false,
    },
  );
  const [rename, setRename] = useState(attrColumn.expression);
  return isFetching ? (
    <Spinner size="sm" mt={2} />
  ) : (
    <HStack>
      <Flex direction="column" gap={1}>
        <Text fontSize="xs" fontWeight="bold">
          RENAME
        </Text>
        <Input
          width={'150px'}
          isInvalid={false}
          value={rename}
          size="sm"
          onChange={(e) => setRename(e.target.value)}
          onBlur={() => onChangeName(rename)}
        />
      </Flex>
    </HStack>
  );
};

export default CustomColumnConfigurator;
