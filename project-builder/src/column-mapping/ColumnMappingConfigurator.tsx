import FieldSelect, {InputColumnOption} from './FieldSelect';
import {
  FormControl,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Tooltip,
  Tr,
} from '@chakra-ui/react';
import React, {FC, useCallback} from 'react';
import {QuestionOutlineIcon} from '@chakra-ui/icons';
import {ColumnSpec} from '../types';

type Props = {
  isReadOnly?: boolean;
  inputTableColumns: InputColumnOption[];
  columns?: Record<string, string>;
  outputColumnSpecs: ColumnSpec[];
  unusedInputColumns: Array<InputColumnOption>;
  onSelect: (column: string, inputFileColumn: string | undefined) => void;
};

const OutputSpecColumnRow: FC<
  Pick<Props, 'isReadOnly' | 'unusedInputColumns' | 'onSelect'> & {
    col: ColumnSpec;
    selectedOption: InputColumnOption | undefined;
  }
> = ({col, selectedOption, onSelect, unusedInputColumns, isReadOnly}) => {
  return (
    <Tr>
      <Td>
        {col.comment ? (
          <Tooltip p={3} label={col.comment} hasArrow placement="left">
            <HStack _hover={{color: 'white'}} transition="color 0.2s ease">
              <QuestionOutlineIcon />
              <Text color={'gray.200'}>{col.name}</Text>
            </HStack>
          </Tooltip>
        ) : (
          <Text>{col.name}</Text>
        )}
      </Td>
      <Td width={250}>
        <FormControl isInvalid={false}>
          <FieldSelect
            isReadOnly={isReadOnly}
            isRequired={col.required}
            colName={col.name}
            selectedOption={selectedOption}
            options={unusedInputColumns}
            handleSelectColumn={onSelect}
          />
        </FormControl>
      </Td>
    </Tr>
  );
};

export const ColumnMappingConfigurator: FC<Props> = (props) => {
  const {
    isReadOnly,
    inputTableColumns,
    columns,
    outputColumnSpecs,
    unusedInputColumns,
    onSelect,
  } = props;
  const findSelectedOption = useCallback(
    (colName: string) => {
      const selectedColumn = columns?.[colName];
      const selectedOption = inputTableColumns.find(
        ({value}) => value === selectedColumn,
      );
      return selectedOption;
    },
    [inputTableColumns, columns],
  );
  return (
    <Table
      size="sm"
      css={{
        '& td': {
          padding: '2px 5px',
        },
      }}
    >
      <Tbody>
        {outputColumnSpecs.map((col) => (
          <OutputSpecColumnRow
            isReadOnly={isReadOnly}
            key={col.name}
            col={col}
            selectedOption={findSelectedOption(col.name)}
            unusedInputColumns={unusedInputColumns}
            onSelect={onSelect}
          />
        ))}
      </Tbody>
    </Table>
  );
};

export default ColumnMappingConfigurator;
