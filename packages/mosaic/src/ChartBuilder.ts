import {ChartBuilderDialog} from './chart-builders/ChartBuilderDialog';
import {FieldSelectorInput} from './chart-builders/FieldSelectorInput';

/**
 * Compound component for building Mosaic charts from templates.
 *
 * @example
 * ```tsx
 * <ChartBuilder.Dialog
 *   open={isOpen}
 *   onOpenChange={setOpen}
 *   tableName="my_table"
 *   columns={columns}
 *   onCreateChart={handleCreate}
 * />
 * ```
 */
export const ChartBuilder = {
  Dialog: ChartBuilderDialog,
  FieldSelector: FieldSelectorInput,
} as const;
