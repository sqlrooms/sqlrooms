import type {FC} from 'react';
import type {AggregateFunction} from '../schemas';
import {Combobox} from './Combobox';

export interface AggregationSelectorProps {
  value: AggregateFunction;
  onChange: (value: AggregateFunction) => void;
}

const AGGREGATION_OPTIONS = [
  {value: 'sum', label: 'SUM'},
  {value: 'avg', label: 'AVG'},
  {value: 'min', label: 'MIN'},
  {value: 'max', label: 'MAX'},
] as const;

/**
 * Dropdown for selecting an aggregation function (SUM, AVG, MIN, MAX).
 */
export const AggregationSelector: FC<AggregationSelectorProps> = ({
  value,
  onChange,
}) => {
  const selectedOption = AGGREGATION_OPTIONS.find((opt) => opt.value === value);

  return (
    <Combobox value={value} onChange={onChange}>
      <Combobox.Trigger className="w-[100px] shadow-none">
        <span>{selectedOption?.label ?? value.toUpperCase()}</span>
      </Combobox.Trigger>
      <Combobox.Content>
        {AGGREGATION_OPTIONS.map((option) => (
          <Combobox.Item key={option.value} value={option.value}>
            <span className="text-xs">{option.label}</span>
          </Combobox.Item>
        ))}
      </Combobox.Content>
    </Combobox>
  );
};
