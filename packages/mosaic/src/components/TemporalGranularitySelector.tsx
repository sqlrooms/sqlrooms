import {type FC, memo, useCallback} from 'react';
import {TEMPORAL_COLUMN_TYPES} from '../column-types-utils';
import type {TemporalInterval} from '../schemas';
import {Combobox} from './Combobox';

interface TemporalGranularitySelectorProps {
  value?: TemporalInterval;
  onChange: (value?: TemporalInterval) => void;
  xFieldType?: string;
}

const TEMPORAL_INTERVALS = [
  {value: 'year', label: 'Year'},
  {value: 'quarter', label: 'Quarter'},
  {value: 'month', label: 'Month'},
  {value: 'week', label: 'Week'},
  {value: 'day', label: 'Day'},
  {value: 'hour', label: 'Hour'},
  {value: 'minute', label: 'Minute'},
  {value: 'second', label: 'Second'},
] as const;

const NONE = 'none';

function isTemporalField(fieldType?: string): boolean {
  if (!fieldType) return false;
  return TEMPORAL_COLUMN_TYPES.some(
    (type) => fieldType.toUpperCase() === type.toUpperCase(),
  );
}

export const TemporalGranularitySelector: FC<TemporalGranularitySelectorProps> =
  memo(({value, onChange, xFieldType}) => {
    // Custom onChange wrapper to handle undefined values
    const handleChange = useCallback(
      (newValue: string) => {
        if (newValue === NONE) {
          onChange(undefined);
        } else {
          onChange(newValue as TemporalInterval);
        }
      },
      [onChange],
    );

    // Only render if X field is temporal
    if (!isTemporalField(xFieldType)) {
      return null;
    }

    const selectedInterval = TEMPORAL_INTERVALS.find(
      (interval) => interval.value === value,
    );
    const displayValue = selectedInterval?.label ?? 'None';
    const currentValue = value || NONE;

    return (
      <Combobox
        value={currentValue}
        onChange={handleChange}
        currentValue={currentValue}
      >
        <Combobox.Trigger className="shadow-none">
          <span>{displayValue}</span>
        </Combobox.Trigger>
        <Combobox.Content>
          <Combobox.Item value={NONE}>
            <span className="text-xs">None</span>
          </Combobox.Item>
          {TEMPORAL_INTERVALS.map((interval) => (
            <Combobox.Item
              key={interval.value}
              value={interval.value}
              isSelected={value === interval.value}
            >
              <span className="text-xs">{interval.label}</span>
            </Combobox.Item>
          ))}
        </Combobox.Content>
      </Combobox>
    );
  });

TemporalGranularitySelector.displayName = 'TemporalGranularitySelector';
