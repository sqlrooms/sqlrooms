import {type FC, memo} from 'react';
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {TEMPORAL_COLUMN_TYPES} from './constants';

interface TemporalGranularitySelectorProps {
  value?:
    | 'year'
    | 'quarter'
    | 'month'
    | 'week'
    | 'day'
    | 'hour'
    | 'minute'
    | 'second';
  onChange: (value?: string) => void;
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

    const handleValueChange = (newValue: string) => {
      if (newValue === 'none') {
        onChange(undefined);
      } else {
        onChange(newValue);
      }
    };

    return (
      <div className="space-y-2">
        <Label>Temporal Granularity</Label>
        <Select value={value || 'none'} onValueChange={handleValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="None (no aggregation)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (no aggregation)</SelectItem>
            {TEMPORAL_INTERVALS.map((interval) => (
              <SelectItem key={interval.value} value={interval.value}>
                {interval.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  });

TemporalGranularitySelector.displayName = 'TemporalGranularitySelector';
