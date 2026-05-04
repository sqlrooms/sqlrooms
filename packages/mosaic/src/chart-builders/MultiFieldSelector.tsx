import {Button} from '@sqlrooms/ui';
import {Plus, Trash2} from 'lucide-react';
import {useState, useCallback, useMemo, type FC} from 'react';
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
  const [addingField, setAddingField] = useState(false);

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
      onChange([...value, {field: fieldName, aggregate: 'sum'}]);
      setAddingField(false);
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

      <div className="space-y-2">
        {value.map((fieldConfig) => {
          const aggregate = fieldConfig.aggregate || 'sum';

          return (
            <div key={fieldConfig.field} className="space-y-2">
              <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                <div className="min-w-[100px] flex-1">
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
                </div>

                <div className="flex flex-0 items-end gap-2">
                  {showAggregation && (
                    <Select
                      value={aggregate}
                      onValueChange={(value: AggregateFunction) =>
                        handleAggregateChange(fieldConfig.field, value)
                      }
                    >
                      <SelectTrigger className="h-10 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">SUM</SelectItem>
                        <SelectItem value="avg">AVG</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveField(fieldConfig.field)}
                    className="h-10 w-10 shrink-0"
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {addingField ? (
          <div className="space-y-2">
            <FieldSelectorInput
              field={{
                key: 'new-field',
                label: 'Select field',
                types,
              }}
              columns={availableColumns}
              value={undefined}
              onChange={handleAddField}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingField(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddingField(true)}
            disabled={availableColumns.length === 0}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Y-axis
          </Button>
        )}
      </div>
    </div>
  );
};
