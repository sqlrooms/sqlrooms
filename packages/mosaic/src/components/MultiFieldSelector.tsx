import {Button} from '@sqlrooms/ui';
import {Trash2} from 'lucide-react';
import {useCallback, useMemo, type FC} from 'react';
import {ColumnSelector} from './ColumnSelector';
import {ColumnsProvider, useColumnsContext} from './ColumnsContext';
import {
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  CATEGORICAL_COLUMN_TYPES,
} from '../column-types-utils';
import type {YFieldConfig} from '../charts/chart-types/line-chart/schema';

type RenderItemFunction = (
  fieldConfig: YFieldConfig,
  index: number,
  handleUpdate: (index: number, updates: Partial<YFieldConfig>) => void,
) => React.ReactNode;

export interface MultiFieldSelectorProps {
  types?: string[];
  value: YFieldConfig[];
  onChange: (value: YFieldConfig[]) => void;
  onAdd: (fieldName: string) => void;
  renderItem?: RenderItemFunction;
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
  onAdd,
  renderItem,
}) => {
  const {columns} = useColumnsContext();

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

  return (
    <div className="space-y-1">
      {value.map((fieldConfig, index) => {
        return (
          <div
            key={fieldConfig.field}
            className="grid items-end gap-2"
            style={{
              gridTemplateColumns: 'minmax(120px, 1fr) auto 32px',
            }}
          >
            <ColumnSelector
              types={types}
              value={fieldConfig.field}
              onChange={(newField) => handleUpdate(index, {field: newField})}
            />

            {renderItem && renderItem(fieldConfig, index, handleUpdate)}

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

      <ColumnsProvider columns={availableColumns}>
        <ColumnSelector
          types={types}
          value={undefined}
          onChange={onAdd}
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
