import {type FC, memo} from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {TEMPORAL_COLUMN_TYPES} from './constants';
import {TemporalInterval} from '../chart-types/line-chart/schema';

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
    // Only render if X field is temporal
    if (!isTemporalField(xFieldType)) {
      return null;
    }

    const handleValueChange = (newValue: TemporalInterval | typeof NONE) => {
      if (newValue === NONE) {
        onChange(undefined);
      } else {
        onChange(newValue);
      }
    };

    return (
      <Select value={value || NONE} onValueChange={handleValueChange}>
        <SelectTrigger className="h-8 text-xs shadow-none">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE} className="text-xs">
            None
          </SelectItem>
          {TEMPORAL_INTERVALS.map((interval) => (
            <SelectItem
              key={interval.value}
              value={interval.value}
              className="text-xs"
            >
              {interval.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  });

TemporalGranularitySelector.displayName = 'TemporalGranularitySelector';
