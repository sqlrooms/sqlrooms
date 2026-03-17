import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@sqlrooms/ui';
import type {Spec} from '@uwdata/mosaic-spec';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {createDefaultChartBuilders} from './builders';
import {FieldSelectorInput} from './FieldSelectorInput';
import {ChartBuilderColumn, MosaicChartBuilder} from './types';

export interface ChartBuilderDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Table name to use in generated specs */
  tableName: string;
  /** Available columns for field selectors */
  columns: ChartBuilderColumn[];
  /** Callback when a chart spec is created */
  onCreateChart: (spec: Spec, title: string) => void;
  /** Custom builders (defaults to all built-in builders) */
  builders?: MosaicChartBuilder[];
}

/**
 * Dialog for creating new Mosaic charts from builder templates.
 *
 * Step 1: Select a chart type from the grid
 * Step 2: Fill in field selectors
 * Step 3: Confirm to generate spec
 */
export const ChartBuilderDialog: React.FC<ChartBuilderDialogProps> = ({
  open,
  onOpenChange,
  tableName,
  columns,
  onCreateChart,
  builders,
}) => {
  const resolvedBuilders = useMemo(
    () => builders ?? createDefaultChartBuilders(),
    [builders],
  );
  const [selectedBuilder, setSelectedBuilder] =
    useState<MosaicChartBuilder | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const handleReset = useCallback(() => {
    setSelectedBuilder(null);
    setFieldValues({});
  }, []);

  const DIALOG_CLOSE_ANIMATION_MS = 200;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(handleReset, DIALOG_CLOSE_ANIMATION_MS);
  }, [onOpenChange, handleReset]);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(handleReset, DIALOG_CLOSE_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
  }, [open, handleReset]);

  const handleSelectBuilder = useCallback((builder: MosaicChartBuilder) => {
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
    handleClose();
  }, [
    selectedBuilder,
    canCreate,
    tableName,
    fieldValues,
    onCreateChart,
    handleClose,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selectedBuilder ? selectedBuilder.description : 'Add Chart'}
          </DialogTitle>
          <DialogDescription>
            {selectedBuilder
              ? 'Configure the chart fields below.'
              : 'Select a chart type to create.'}
          </DialogDescription>
        </DialogHeader>

        {!selectedBuilder ? (
          // Step 1: Chart type selection grid
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
          // Step 2: Field configuration
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

        <DialogFooter>
          {selectedBuilder && (
            <Button variant="outline" onClick={handleReset}>
              Back
            </Button>
          )}
          {selectedBuilder && (
            <Button onClick={handleCreate} disabled={!canCreate}>
              Create
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
