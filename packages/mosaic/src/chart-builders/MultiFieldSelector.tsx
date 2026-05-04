import {Button} from '@sqlrooms/ui';
import {Plus, X} from 'lucide-react';
import React, {useState, useCallback, useMemo, type FC} from 'react';
import {ChartBuilderColumn} from './types';
import {FieldSelectorInput} from './FieldSelectorInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';

export interface MultiFieldSelectorProps {
  label: string;
  columns: ChartBuilderColumn[];
  types?: string[];
  value: {field: string; color?: string; aggregate?: 'sum' | 'avg'}[];
  onChange: (
    value: {field: string; color?: string; aggregate?: 'sum' | 'avg'}[],
  ) => void;
  required?: boolean;
  showAggregation?: boolean; // NEW: show aggregation dropdowns
}

export const MultiFieldSelector: FC<MultiFieldSelectorProps> = ({
  label,
  columns,
  types,
  value,
  onChange,
  required,
  showAggregation = false, // NEW
}) => {
  const [addingField, setAddingField] = useState(false);

  const selectedFieldNames = useMemo(() => value.map((v) => v.field), [value]);

  const availableColumns = useMemo(
    () => columns.filter((col) => !selectedFieldNames.includes(col.name)),
    [columns, selectedFieldNames],
  );

  const handleRemoveField = useCallback(
    (fieldToRemove: string) => {
      if (value.length <= 1 && required) {
        return;
      }
      onChange(value.filter((v) => v.field !== fieldToRemove));
    },
    [value, onChange, required],
  );

  const handleAddField = useCallback(
    (fieldName: string) => {
      onChange([...value, {field: fieldName, aggregate: 'sum'}]);
      setAddingField(false);
    },
    [value, onChange],
  );

  const handleAggregateChange = useCallback(
    (fieldName: string, aggregate: 'sum' | 'avg') => {
      onChange(
        value.map((v) => (v.field === fieldName ? {...v, aggregate} : v)),
      );
    },
    [value, onChange],
  );

  const getColumnType = useCallback(
    (fieldName: string) => {
      const col = columns.find((c) => c.name === fieldName);
      return col?.type;
    },
    [columns],
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      <div className="space-y-2">
        {value.map((fieldConfig) => {
          const columnType = getColumnType(fieldConfig.field);
          const canRemove = value.length > 1 || !required;
          const aggregate = fieldConfig.aggregate || 'sum';

          return (
            <div
              key={fieldConfig.field}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <div className="flex-1 truncate">
                <span className="font-medium">{fieldConfig.field}</span>
                {columnType && (
                  <span className="text-muted-foreground ml-2 text-xs">
                    {columnType}
                  </span>
                )}
              </div>

              {/* NEW: Aggregation dropdown */}
              {showAggregation && (
                <Select
                  value={aggregate}
                  onValueChange={(value: 'sum' | 'avg') =>
                    handleAggregateChange(fieldConfig.field, value)
                  }
                >
                  <SelectTrigger className="h-8 w-20">
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
                size="sm"
                onClick={() => handleRemoveField(fieldConfig.field)}
                disabled={!canRemove}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
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
