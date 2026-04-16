import type {ReactElement} from 'react';
import {mosaicChartBuilders} from './chart-builders/builders';
import {mosaicChartTypes} from './chart-builders/chartTypes';
import {ChartBuilderActions} from './chart-builders/ChartBuilderActions';
import {ChartBuilderContent} from './chart-builders/ChartBuilderContent';
import {
  ChartBuilderDialog,
  ChartBuilderDialogContent,
  ChartBuilderRoot,
  type ChartBuilderRootProps,
  ChartBuilderTrigger,
} from './chart-builders/ChartBuilderDialog';
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
  chartTypes: typeof mosaicChartTypes;
  chartBuilders: typeof mosaicChartBuilders;
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
      /** Named built-in chart-type definitions. */
      chartTypes: mosaicChartTypes,
      /** Named built-in chart templates (same objects as default set). */
      chartBuilders: mosaicChartBuilders,
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
