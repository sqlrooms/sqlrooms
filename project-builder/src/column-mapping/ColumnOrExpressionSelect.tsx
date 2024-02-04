import {
  Button,
  Flex,
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Text,
} from '@chakra-ui/react';
import {CodeBracketIcon} from '@heroicons/react/24/outline';
import {ChevronDownIcon} from '@heroicons/react/24/solid';
import {FC} from 'react';
import {InputColumnOption} from './FieldSelect';
import TableFieldLabel from './TableFieldLabel';

type Props = {
  title: string;
  icon: React.ReactElement;
  unusedInputColumns: Array<InputColumnOption>;
  onSelect: (expr: string) => void;
};
const ColumnOrExpressionSelect: FC<Props> = (props) => {
  const {title, icon, unusedInputColumns, onSelect} = props;
  return (
    <Menu placement="bottom-end">
      <MenuButton
        as={Button}
        size="sm"
        variant="solid"
        color="white"
        rightIcon={<ChevronDownIcon width={15} height={15} />}
        // isDisabled={!unusedInputColumns.length}
      >
        <Flex justifyContent="center">
          <HStack>
            {icon}

            <Text>{title}</Text>
          </HStack>
        </Flex>
      </MenuButton>
      <Portal>
        <MenuList>
          {unusedInputColumns.map((column) => (
            <MenuItem
              fontSize="sm"
              key={column.value}
              color="white"
              onClick={() => onSelect(column.value)}
            >
              <TableFieldLabel field={column.row} showTypeBadge />
            </MenuItem>
          ))}
          <MenuItem
            icon={<CodeBracketIcon width="16px" />}
            fontSize="sm"
            color="white"
            isDisabled={true}
          >
            SQL expression
          </MenuItem>
        </MenuList>
      </Portal>
    </Menu>
  );
};

export default ColumnOrExpressionSelect;
