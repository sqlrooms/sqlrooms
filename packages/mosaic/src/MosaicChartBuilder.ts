import type {ReactElement} from 'react';
import {ChartBuilderActions} from './chart-builders/ChartBuilderActions';
import {ChartBuilderContent} from './chart-builders/ChartBuilderContent';
import {
  ChartBuilderDialog,
  ChartBuilderDialogContent,
  ChartBuilderTrigger,
} from './chart-builders/ChartBuilderDialog';
import {
  ChartBuilderRoot,
  type ChartBuilderRootProps,
} from './chart-builders/ChartBuilderRoot';
import {ChartBuilderFields} from './chart-builders/ChartBuilderFields';
import {ChartBuilderTypeGrid} from './chart-builders/ChartBuilderTypeGrid';
import {FieldSelectorInput} from './chart-builders/FieldSelectorInput';

/**
 * Compound component for building Mosaic charts from templates.
 *
 * Use `<MosaicChartBuilder>` as the root; it provides context and wraps a
 * Radix Dialog.
 *
 * @example Compound usage (recommended)
 * ```tsx
 * <MosaicChartBuilder
 *   tableName="my_table"
 *   columns={columns}
 *   onCreateChart={handleCreate}
 * >
 *   <MosaicChartBuilder.Trigger />
 *   <MosaicChartBuilder.Dialog />
 * </MosaicChartBuilder>
 * ```
 *
 * @example Custom trigger button
 * ```tsx
 * <MosaicChartBuilder
 *   tableName="my_table"
 *   columns={columns}
 *   onCreateChart={handleCreate}
 * >
 *   <MosaicChartBuilder.Trigger variant="ghost" size="icon">
 *     <PlusIcon />
 *   </MosaicChartBuilder.Trigger>
 *   <MosaicChartBuilder.Dialog />
 * </MosaicChartBuilder>
 * ```
 *
 * @example Inline builder (no dialog)
 * ```tsx
 * <MosaicChartBuilder.Content
 *   tableName="my_table"
 *   columns={columns}
 *   onCreateChart={handleCreate}
 * />
 * ```
 */

type MosaicChartBuilderCompoundComponent = ((
  props: ChartBuilderRootProps,
) => ReactElement) & {
  Root: typeof ChartBuilderRoot;
  Trigger: typeof ChartBuilderTrigger;
  Dialog: typeof ChartBuilderDialogContent;
  Content: typeof ChartBuilderContent;
  TypeGrid: typeof ChartBuilderTypeGrid;
  Fields: typeof ChartBuilderFields;
  Actions: typeof ChartBuilderActions;
  FieldSelector: typeof FieldSelectorInput;
  LegacyDialog: typeof ChartBuilderDialog;
};

export const MosaicChartBuilder: MosaicChartBuilderCompoundComponent =
  Object.assign(
    ChartBuilderRoot as (props: ChartBuilderRootProps) => ReactElement,
    {
      Root: ChartBuilderRoot,
      /** Default trigger button; customize via ButtonProps or children. */
      Trigger: ChartBuilderTrigger,
      /** Dialog content pane with chart-builder steps. */
      Dialog: ChartBuilderDialogContent,
      /** Standalone builder UI (no dialog wrapper). */
      Content: ChartBuilderContent,
      /** Built-in chart-type picker grid. */
      TypeGrid: ChartBuilderTypeGrid,
      /** Field selectors for the currently selected chart type. */
      Fields: ChartBuilderFields,
      /** Back/Create actions for the current chart type selection. */
      Actions: ChartBuilderActions,
      /** Field selector primitive. */
      FieldSelector: FieldSelectorInput,
      /** Legacy one-shot dialog (backward-compatible). */
      LegacyDialog: ChartBuilderDialog,
    },
  );
