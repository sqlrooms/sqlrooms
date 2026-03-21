import {Button, cn} from '@sqlrooms/ui';
import type {Spec} from '@uwdata/mosaic-spec';
import React, {useCallback, useMemo, useState} from 'react';
import {createDefaultChartBuilders} from './builders';
import {FieldSelectorInput} from './FieldSelectorInput';
import {ChartBuilderColumn, ChartBuilderTemplate} from './types';

export interface ChartBuilderContentProps {
  /** Table name to use in generated specs */
  tableName: string;
  /** Available columns for field selectors */
  columns: ChartBuilderColumn[];
  /** Callback when a chart spec is created */
  onCreateChart: (spec: Spec, title: string) => void;
  /** Custom builders (defaults to all built-in builders) */
  builders?: ChartBuilderTemplate[];
  /** Custom class name */
  className?: string;
}

/**
 * Standalone chart builder UI for creating Mosaic charts from templates.
 *
 * Step 1: Select a chart type from the grid
 * Step 2: Fill in field selectors
 * Step 3: Confirm to generate spec
 *
 * Can be used directly without a dialog wrapper.
 */
export const ChartBuilderContent: React.FC<ChartBuilderContentProps> = ({
  tableName,
  columns,
  onCreateChart,
  builders,
  className,
}) => {
  const resolvedBuilders = useMemo(
    () => builders ?? createDefaultChartBuilders(),
    [builders],
  );
  const [selectedBuilder, setSelectedBuilder] =
    useState<ChartBuilderTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const handleReset = useCallback(() => {
    setSelectedBuilder(null);
    setFieldValues({});
  }, []);

  const handleSelectBuilder = useCallback((builder: ChartBuilderTemplate) => {
    setSelectedBuilder(builder);
    setFieldValues({});
  }, []);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFieldValues((prev) => ({...prev, [key]: value}));
  }, []);

  const canCreate = useMemo(() => {
    if (!selectedBuilder) return false;
    return selectedBuilder.fields
      .filter((f) => f.required ?? true)
      .every((f) => fieldValues[f.key]);
  }, [selectedBuilder, fieldValues]);

  const handleCreate = useCallback(() => {
    if (!selectedBuilder || !canCreate) return;
    const spec = selectedBuilder.createSpec(tableName, fieldValues);
    const title =
      selectedBuilder.fields.length > 0
        ? `${selectedBuilder.description.replace(/^Create (a |an )?/, '')} - ${Object.values(fieldValues).join(', ')}`
        : selectedBuilder.description.replace(/^Create (a |an )?/, '');
    onCreateChart(spec, title);
    handleReset();
  }, [
    selectedBuilder,
    canCreate,
    tableName,
    fieldValues,
    onCreateChart,
    handleReset,
  ]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {!selectedBuilder ? (
        <div className="grid grid-cols-2 gap-2 py-2">
          {resolvedBuilders.map((builder) => {
            const Icon = builder.icon;
            return (
              <button
                key={builder.id}
                className={cn(
                  'flex items-center gap-3 rounded-md border p-3 text-left transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                )}
                onClick={() => handleSelectBuilder(builder)}
              >
                <Icon className="h-5 w-5 shrink-0 opacity-70" />
                <span className="text-sm">{builder.description}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-2">
          {selectedBuilder.fields.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              This chart type has no configurable fields. A template spec will
              be created that you can edit manually.
            </p>
          ) : (
            selectedBuilder.fields.map((field) => (
              <FieldSelectorInput
                key={field.key}
                field={field}
                columns={columns}
                value={fieldValues[field.key]}
                onChange={(v) => handleFieldChange(field.key, v)}
              />
            ))
          )}
        </div>
      )}

      {selectedBuilder && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Back
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!canCreate}>
            Create
          </Button>
        </div>
      )}
    </div>
  );
};
