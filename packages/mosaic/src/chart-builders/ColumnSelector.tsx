import {type FC} from 'react';
import {FieldSelectorInput} from './FieldSelectorInput';
import {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  CATEGORICAL_COLUMN_TYPES,
} from './constants';
import {useChartSettingsContext} from '../chart/chart-settings/ChartSettingsContext';
import {TableColumn} from '@sqlrooms/db';

export interface ColumnSelectorProps {
  types?: string[];
  columns?: TableColumn[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Simplified wrapper around FieldSelectorInput for selecting a table column.
 * Removes the field prop requirement for easier composition.
 *
 * Can be used as:
 * - `<ColumnSelector types={...} />` - custom types
 * - `<ColumnSelector.Numeric />` - numeric types only
 * - `<ColumnSelector.Quantitative />` - numeric + temporal
 * - `<ColumnSelector.Categorical />` - text/enum types
 */
const ColumnSelectorRoot: FC<ColumnSelectorProps> = ({
  types,
  value,
  onChange,
  columns,
  placeholder,
}) => {
  const {columns: contextColumns} = useChartSettingsContext();

  return (
    <FieldSelectorInput
      field={{
        key: '',
        label: '',
        types,
      }}
      columns={columns ?? contextColumns}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
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
