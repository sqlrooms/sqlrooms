import {type FC} from 'react';
import {FieldSelectorInput} from './FieldSelectorInput';
import {NUMERIC_COLUMN_TYPES, QUANTITATIVE_COLUMN_TYPES} from './constants';
import {useChartSettingsContext} from '../dashboard/chart-settings/ChartSettingsContext';
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
 */
export const ColumnSelector: FC<ColumnSelectorProps> = ({
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

export const QuantitativeColumnSelector: FC<
  Omit<ColumnSelectorProps, 'types'>
> = (props) => <ColumnSelector {...props} types={QUANTITATIVE_COLUMN_TYPES} />;

export const NumericColumnSelector: FC<Omit<ColumnSelectorProps, 'types'>> = (
  props,
) => <ColumnSelector {...props} types={NUMERIC_COLUMN_TYPES} />;
