import {Badge, useTheme} from '@chakra-ui/react';
import styled from '@emotion/styled';
import {AppContext} from '@flowmapcity/components';
import {Select} from 'chakra-react-select';
import {useContext} from 'react';
import TableFieldLabel from './TableFieldLabel';

export type TableField = {name: string; type: string};

export type InputColumnOption = {
  value: string;
  row: TableField;
};

type Props = {
  isReadOnly?: boolean;
  selectedOption: InputColumnOption | undefined;
  options: Array<InputColumnOption>;
  handleSelectColumn: (
    column: string,
    inputFileColumn: string | undefined,
  ) => void;
  colName: string;
  isRequired?: boolean;
};
const SelectOuter = styled.div`
  & > div > div {
    width: unset;
  }
`;
const FieldSelect = ({
  isReadOnly,
  selectedOption,
  colName,
  isRequired,
  options,
  handleSelectColumn,
}: Props) => {
  const theme = useTheme();
  const appContext = useContext(AppContext);
  return (
    <SelectOuter>
      <Select<InputColumnOption>
        name="columns"
        value={selectedOption ?? null} // undefined would not change selection
        options={options}
        isDisabled={isReadOnly}
        placeholder={
          isRequired ? (
            <Badge colorScheme="purple" fontSize="9" variant="outline">
              required
            </Badge>
          ) : (
            <Badge fontSize="9" color="gray.200" variant="outline">
              optional
            </Badge>
          )
        }
        size="sm"
        closeMenuOnSelect={true}
        isMulti={false}
        isSearchable={true}
        isClearable={true}
        menuPlacement="auto"
        menuPortalTarget={
          appContext.mode !== 'sdk' ? appContext.portalRef?.current : undefined
        }
        chakraStyles={{
          dropdownIndicator: (provided) => ({
            ...provided,
            backgroundColor: theme.colors.gray[700],
          }),
          menuList: (provided) => ({
            ...provided,
            backgroundColor: theme.colors.gray[700],
          }),
          option: (provided, state) => ({
            ...provided,
            ...(state.isFocused
              ? {
                  backgroundColor: theme.colors.gray[600],
                  color: theme.colors.gray[300],
                }
              : null),
          }),
        }}
        formatOptionLabel={({row}, {context}) => (
          <TableFieldLabel field={row} showTypeBadge={context === 'menu'} />
        )}
        onChange={(selected) => handleSelectColumn(colName, selected?.value)}
      />
    </SelectOuter>
  );
};

export default FieldSelect;
