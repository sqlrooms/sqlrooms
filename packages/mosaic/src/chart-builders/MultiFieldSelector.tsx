import {Button} from '@sqlrooms/ui';
import {Trash2} from 'lucide-react';
import {useCallback, useMemo, type FC} from 'react';
import {ColumnSelector} from './ColumnSelector';
import {AggregationSelector} from './AggregationSelector';
import type {AggregateFunction} from '../charts/chart-types/line-chart/schema';
import {ColumnsProvider, useColumnsContext} from './ColumnsContext';
import {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  CATEGORICAL_COLUMN_TYPES,
} from './constants';
import type {YFieldConfig} from '../charts/chart-types/line-chart/schema';

export interface MultiFieldSelectorProps {
  types?: string[];
  value: YFieldConfig[];
  onChange: (value: YFieldConfig[]) => void;
  showAggregation?: boolean;
}

/**
 * Manages an array of field configurations with add/update/remove logic.
 * Emits the full updated array on every change.
 *
 * Can be used as:
 * - `<MultiFieldSelector types={...} />` - custom types
 * - `<MultiFieldSelector.Numeric />` - numeric types only
 * - `<MultiFieldSelector.Quantitative />` - numeric + temporal
 * - `<MultiFieldSelector.Categorical />` - text/enum types
 */
const MultiFieldSelectorRoot: FC<MultiFieldSelectorProps> = ({
  types,
  value,
  onChange,
  showAggregation = false,
}) => {
  const {columns, tableName} = useColumnsContext();

  const selectedFieldNames = useMemo(() => value.map((v) => v.field), [value]);

  const availableColumns = useMemo(
    () => columns.filter((col) => !selectedFieldNames.includes(col.name)),
    [columns, selectedFieldNames],
  );

  const handleUpdate = useCallback(
    (index: number, updates: Partial<(typeof value)[0]>) => {
      const updated = [...value];
      updated[index] = {...updated[index]!, ...updates};
      onChange(updated);
    },
    [value, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const handleAdd = useCallback(
    (fieldName: string) => {
      if (fieldName) {
        onChange([...value, {field: fieldName, aggregate: 'sum'}]);
      }
    },
    [value, onChange],
  );

  return (
    <div className="space-y-1">
      {value.map((fieldConfig, index) => {
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
            <ColumnSelector
              types={types}
              value={fieldConfig.field}
              onChange={(newField) => handleUpdate(index, {field: newField})}
            />

            {showAggregation && (
              <AggregationSelector
                value={aggregate}
                onChange={(agg: AggregateFunction) =>
                  handleUpdate(index, {aggregate: agg})
                }
              />
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              className="h-8 w-8 shrink-0"
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        );
      })}

      <ColumnsProvider columns={availableColumns} tableName={tableName}>
        <ColumnSelector
          types={types}
          value={undefined}
          onChange={handleAdd}
          placeholder="Select field..."
        />
      </ColumnsProvider>
    </div>
  );
};

const Numeric: FC<Omit<MultiFieldSelectorProps, 'types'>> = (props) => (
  <MultiFieldSelectorRoot {...props} types={NUMERIC_COLUMN_TYPES} />
);

const Quantitative: FC<Omit<MultiFieldSelectorProps, 'types'>> = (props) => (
  <MultiFieldSelectorRoot {...props} types={QUANTITATIVE_COLUMN_TYPES} />
);

const Categorical: FC<Omit<MultiFieldSelectorProps, 'types'>> = (props) => (
  <MultiFieldSelectorRoot {...props} types={CATEGORICAL_COLUMN_TYPES} />
);

export const MultiFieldSelector = Object.assign(MultiFieldSelectorRoot, {
  Numeric,
  Quantitative,
  Categorical,
});
