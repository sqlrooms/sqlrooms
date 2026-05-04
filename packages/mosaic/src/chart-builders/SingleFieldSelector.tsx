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
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
        <div className="min-w-[100px] flex-1">
          <FieldSelectorInput
            field={field}
            columns={columns}
            value={value}
            onChange={onChange}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex-1">
            <TemporalGranularitySelector
              value={temporalValue}
              onChange={onTemporalChange!}
              xFieldType={xFieldType}
            />
          </div>
        </div>
      </div>
    );
  },
);

SingleFieldSelector.displayName = 'SingleFieldSelector';
