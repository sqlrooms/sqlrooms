import {FormControl, Table, Tbody, Td, Text, Tr} from '@chakra-ui/react';
import {InfoBox} from '@sqlrooms/components';
import {FC, useCallback} from 'react';
import {ColumnSpec} from '../types';
import FieldSelect, {InputColumnOption} from './FieldSelect';

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
          <InfoBox content={col.comment}>
            <Text color={'gray.200'}>{col.name}</Text>
          </InfoBox>
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
