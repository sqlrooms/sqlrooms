import {HStack, Badge, Text} from '@chakra-ui/react';
import React, {FC} from 'react';
import {TableField} from './FieldSelect';
type Props = {
  field: TableField;
  showTypeBadge?: boolean;
};
const TableFieldLabel: FC<Props> = (props) => {
  const {field, showTypeBadge} = props;
  return (
    <HStack>
      {showTypeBadge ? (
        <Text width="50px">
          <Badge colorScheme="teal" fontSize={9} variant="outline">
            {field.type}
          </Badge>
        </Text>
      ) : null}
      <Text>{field.name}</Text>
    </HStack>
  );
};

export default TableFieldLabel;
