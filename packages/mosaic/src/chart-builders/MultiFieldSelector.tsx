import {Button} from '@sqlrooms/ui';
import {Trash2} from 'lucide-react';
import {useCallback, useMemo, type FC} from 'react';
import {ChartBuilderColumn} from './types';
import {FieldSelectorInput} from './FieldSelectorInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import type {
  AggregateFunction,
  YFieldConfig,
} from '../chart-types/line-chart/schema';

export interface MultiFieldSelectorProps {
  label: string;
  columns: ChartBuilderColumn[];
  types?: string[];
  value: YFieldConfig[];
  onChange: (value: YFieldConfig[]) => void;
  required?: boolean;
  showAggregation?: boolean;
}

export const MultiFieldSelector: FC<MultiFieldSelectorProps> = ({
  label,
  columns,
  types,
  value,
  onChange,
  required,
  showAggregation = false,
}) => {
  const selectedFieldNames = useMemo(() => value.map((v) => v.field), [value]);

  const availableColumns = useMemo(
    () => columns.filter((col) => !selectedFieldNames.includes(col.name)),
    [columns, selectedFieldNames],
  );

  const handleRemoveField = useCallback(
    (fieldToRemove: string) => {
      onChange(value.filter((v) => v.field !== fieldToRemove));
    },
    [value, onChange],
  );

  const handleAddField = useCallback(
    (fieldName: string) => {
      if (fieldName) {
        onChange([...value, {field: fieldName, aggregate: 'sum'}]);
      }
    },
    [value, onChange],
  );

  const handleAggregateChange = useCallback(
    (fieldName: string, aggregate: AggregateFunction) => {
      onChange(
        value.map((v) => (v.field === fieldName ? {...v, aggregate} : v)),
      );
    },
    [value, onChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      <div className="space-y-1">
        {value.map((fieldConfig) => {
          const aggregate = fieldConfig.aggregate || 'sum';

          return (
            <div
              key={fieldConfig.field}
              className="grid items-end gap-2"
              style={{
                gridTemplateColumns: showAggregation
                  ? 'minmax(120px, 1fr) 100px 32px'
                  : 'minmax(120px, 1fr) 32px',
              }}
            >
              <FieldSelectorInput
                field={{
                  key: fieldConfig.field,
                  label: '',
                  types,
                }}
                columns={columns}
                value={fieldConfig.field}
                onChange={(newField) => {
                  onChange(
                    value.map((v) =>
                      v.field === fieldConfig.field
                        ? {...v, field: newField}
                        : v,
                    ),
                  );
                }}
              />

              {showAggregation && (
                <Select
                  value={aggregate}
                  onValueChange={(value: AggregateFunction) =>
                    handleAggregateChange(fieldConfig.field, value)
                  }
                >
                  <SelectTrigger className="h-8 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum" className="text-xs">
                      SUM
                    </SelectItem>
                    <SelectItem value="avg" className="text-xs">
                      AVG
                    </SelectItem>
                    <SelectItem value="min" className="text-xs">
                      MIN
                    </SelectItem>
                    <SelectItem value="max" className="text-xs">
                      MAX
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveField(fieldConfig.field)}
                className="h-8 w-8 shrink-0"
              >
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            </div>
          );
        })}

        <div
          className="grid items-end gap-2"
          style={{
            gridTemplateColumns: showAggregation
              ? 'minmax(120px, 1fr) 100px 32px'
              : 'minmax(120px, 1fr) 32px',
          }}
        >
          <FieldSelectorInput
            field={{
              key: 'add-field',
              label: '',
              types,
            }}
            columns={availableColumns}
            value={undefined}
            onChange={handleAddField}
            placeholder="Select field..."
          />
          {showAggregation && <div className="w-[100px]" />}
          <div className="h-8 w-8 shrink-0" />
        </div>
      </div>
    </div>
  );
};
