import {type FC, memo} from 'react';
import {FieldSelectorInput} from './FieldSelectorInput';
import {TemporalGranularitySelector} from './TemporalGranularitySelector';
import type {ChartBuilderField, ChartBuilderColumn} from './types';
import type {TemporalInterval} from '../chart-types/line-chart/schema';

export interface SingleFieldSelectorProps {
  field: ChartBuilderField;
  columns: ChartBuilderColumn[];
  value: string | undefined;
  onChange: (value: string) => void;
  // Optional temporal granularity props
  showTemporalSelector?: boolean;
  xFieldType?: string;
  temporalValue?: TemporalInterval;
  onTemporalChange?: (value?: TemporalInterval) => void;
}

export const SingleFieldSelector: FC<SingleFieldSelectorProps> = memo(
  ({
    field,
    columns,
    value,
    onChange,
    showTemporalSelector = false,
    xFieldType,
    temporalValue,
    onTemporalChange,
  }) => {
    if (!showTemporalSelector) {
      return (
        <FieldSelectorInput
          field={field}
          columns={columns}
          value={value}
          onChange={onChange}
        />
      );
    }

    return (
      <div
        className="grid items-end gap-2"
        style={{
          gridTemplateColumns: 'minmax(120px, 1fr) auto',
        }}
      >
        <FieldSelectorInput
          field={field}
          columns={columns}
          value={value}
          onChange={onChange}
        />
        <TemporalGranularitySelector
          value={temporalValue}
          onChange={onTemporalChange!}
          xFieldType={xFieldType}
        />
      </div>
    );
  },
);

SingleFieldSelector.displayName = 'SingleFieldSelector';
