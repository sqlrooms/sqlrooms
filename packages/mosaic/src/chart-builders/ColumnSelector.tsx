import type {FC} from 'react';
import {FieldSelectorInput} from './FieldSelectorInput';
import type {ChartBuilderColumn} from './types';

export interface ColumnSelectorProps {
  columns: ChartBuilderColumn[];
  types?: string[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Simplified wrapper around FieldSelectorInput for selecting a table column.
 * Removes the field prop requirement for easier composition.
 */
export const ColumnSelector: FC<ColumnSelectorProps> = ({
  columns,
  types,
  value,
  onChange,
  placeholder,
}) => {
  return (
    <FieldSelectorInput
      field={{
        key: '',
        label: '',
        types,
      }}
      columns={columns}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
};
