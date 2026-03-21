import {ChartBuilderContent} from './chart-builders/ChartBuilderContent';
import {ChartBuilderDialog} from './chart-builders/ChartBuilderDialog';
import {FieldSelectorInput} from './chart-builders/FieldSelectorInput';

/**
 * Compound component for building Mosaic charts from templates.
 *
 * Use `MosaicChartBuilder.Content` for an inline builder, or
 * `MosaicChartBuilder.Dialog` for a dialog-wrapped version.
 *
 * @example Inline usage
 * ```tsx
 * <MosaicChartBuilder.Content
 *   tableName="my_table"
 *   columns={columns}
 *   onCreateChart={handleCreate}
 * />
 * ```
 *
 * @example Dialog usage
 * ```tsx
 * <MosaicChartBuilder.Dialog
 *   open={isOpen}
 *   onOpenChange={setOpen}
 *   tableName="my_table"
 *   columns={columns}
 *   onCreateChart={handleCreate}
 * />
 * ```
 */
export const MosaicChartBuilder = {
  Content: ChartBuilderContent,
  Dialog: ChartBuilderDialog,
  FieldSelector: FieldSelectorInput,
} as const;
