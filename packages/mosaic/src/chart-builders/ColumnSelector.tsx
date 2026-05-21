import {type FC} from 'react';
import {FieldSelectorInput} from './FieldSelectorInput';
import {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  CATEGORICAL_COLUMN_TYPES,
} from './constants';
import {useColumnsContext} from './ColumnsContext';

export interface ColumnSelectorProps {
  types?: string[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Simplified wrapper around FieldSelectorInput for selecting a table column.
 * Removes the field prop requirement for easier composition.
 *
 * Can be used as:
 * - `<ColumnSelector.Numeric />` - numeric types only
 * - `<ColumnSelector.Quantitative />` - numeric + temporal
 * - `<ColumnSelector.Categorical />` - text/enum types
 */
const ColumnSelectorRoot: FC<ColumnSelectorProps> = ({
  types,
  value,
  onChange,
  placeholder,
}) => {
  const {columns} = useColumnsContext();

  return (
    <FieldSelectorInput
      field={{
        key: '',
        label: '',
        types,
      }}
      value={value}
      columns={columns}
      onChange={onChange}
      placeholder={placeholder ?? 'Select column…'}
    />
  );
};

const Numeric: FC<Omit<ColumnSelectorProps, 'types'>> = (props) => (
  <ColumnSelectorRoot {...props} types={NUMERIC_COLUMN_TYPES} />
);

const Quantitative: FC<Omit<ColumnSelectorProps, 'types'>> = (props) => (
  <ColumnSelectorRoot {...props} types={QUANTITATIVE_COLUMN_TYPES} />
);

const Categorical: FC<Omit<ColumnSelectorProps, 'types'>> = (props) => (
  <ColumnSelectorRoot {...props} types={CATEGORICAL_COLUMN_TYPES} />
);

export const ColumnSelector = Object.assign(ColumnSelectorRoot, {
  Numeric,
  Quantitative,
  Categorical,
});
