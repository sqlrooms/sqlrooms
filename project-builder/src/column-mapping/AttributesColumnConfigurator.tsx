import {
  IconButton,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import {EditableText} from '@flowmapcity/components';
import {AttributeColumn, ColumnMapping} from '@flowmapcity/project-config';
import {convertToUniqueColumnOrTableName} from '@flowmapcity/utils';
import {TrashIcon} from '@heroicons/react/24/outline';
import {produce} from 'immer';
import {FC} from 'react';
import {ColumnSpec} from '../types';
import {InputColumnOption} from './FieldSelect';

type Props = {
  isReadOnly?: boolean;
  inputTableColumns: InputColumnOption[];
  attributes?: ColumnMapping['attributes'];
  outputColumnSpecs?: ColumnSpec[];
  usedOutputColNames: string[];
  onChange: (attributes?: ColumnMapping['attributes']) => void;
};

export const AttributesColumnConfigurator: FC<Props> = (props) => {
  const {isReadOnly, attributes, usedOutputColNames, onChange} = props;
  const handleDelete = (attr: AttributeColumn) => {
    const nextAttrs = attributes?.filter((a) => a.column !== attr.column);
    onChange(nextAttrs);
  };
  const handleChangeColumn = (attr: AttributeColumn, label: string) => {
    if (!attributes) return;
    const nextLabel = label.trim() || attr.label;
    const nextColName = convertToUniqueColumnOrTableName(
      nextLabel,
      usedOutputColNames,
    );
    const nextAttrs = produce(attributes, (draft) => {
      const nextAttr = draft.find((a) => a.expression === attr.expression);
      if (nextAttr) {
        nextAttr.label = nextLabel;
        nextAttr.column = nextColName;
      }
    });
    onChange(nextAttrs);
    return nextLabel; // Pass to EditableText
  };
  if (!attributes?.length) return null;
  return (
    <Table size="sm" css={{'& td,& th': {padding: '2px 0'}}}>
      <Thead>
        <Tr>
          <Th />
          <Th>Label</Th>
          <Th>Expression</Th>
        </Tr>
      </Thead>
      <Tbody>
        {attributes?.map((attrColumn, i) => (
          <Tr key={i}>
            <Td>
              <IconButton
                variant="ghost"
                size="xs"
                aria-label="delete"
                color="gray.300"
                onClick={() => handleDelete(attrColumn)}
                icon={<TrashIcon width="15px" />}
              />
            </Td>
            <Td>
              {isReadOnly ? (
                <Text>{attrColumn.label}</Text>
              ) : (
                <EditableText
                  textAlign="left"
                  maxWidth="200px"
                  color={'gray.200'}
                  value={attrColumn.label}
                  onValidate={(name) =>
                    AttributeColumn.shape.label.safeParse(name)
                  }
                  onChange={(name) => handleChangeColumn(attrColumn, name)}
                  error={undefined}
                  isLoading={false}
                />
              )}
            </Td>
            <Td maxWidth="100px">{attrColumn.expression}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

export default AttributesColumnConfigurator;
