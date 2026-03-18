/**
 * {@include ../README.md}
 * @packageDocumentation
 */
export {
  isParam,
  isSelection,
  makeClient,
  Param,
  Selection,
} from '@uwdata/mosaic-core';
export type {Spec} from '@uwdata/mosaic-spec';
export {Query, sql} from '@uwdata/mosaic-sql';
export * as vg from '@uwdata/vgplot';
export {
  createDefaultMosaicConfig,
  createMosaicSlice,
  MosaicSliceConfig,
  type MosaicClientOptions,
  type TrackedClient,
} from './MosaicSlice';
export {useMosaicClient, type UseMosaicClientOptions} from './useMosaicClient';
export {VgPlotChart} from './VgPlotChart';

// Compound components
export {MosaicChart} from './MosaicChart';
export {ChartBuilder} from './ChartBuilder';

// Editor sub-components (also accessible via MosaicChart.*)
export {MosaicChartContainer} from './editor/MosaicChartContainer';
export type {MosaicChartContainerProps} from './editor/MosaicChartContainer';
export {MosaicChartDisplay} from './editor/MosaicChartDisplay';
export type {MosaicChartDisplayProps} from './editor/MosaicChartDisplay';
export {MosaicSpecEditorPanel} from './editor/MosaicSpecEditorPanel';
export type {MosaicSpecEditorPanelProps} from './editor/MosaicSpecEditorPanel';
export {MosaicChartEditorActions} from './editor/MosaicChartEditorActions';
export type {MosaicChartEditorActionsProps} from './editor/MosaicChartEditorActions';
export {MosaicCodeMirrorEditor} from './editor/MosaicCodeMirrorEditor';
export type {MosaicCodeMirrorEditorProps} from './editor/MosaicCodeMirrorEditor';
export {useMosaicChartEditor} from './editor/useMosaicChartEditor';
export {useMosaicEditorContext} from './editor/MosaicEditorContext';
export {
  loadMosaicSchema,
  getCachedMosaicSchema,
  preloadMosaicSchema,
} from './editor/mosaicSchema';
export type {
  MosaicEditorState,
  MosaicEditorActions,
  MosaicEditorContextValue,
  OnMosaicSpecChange,
  UseMosaicChartEditorOptions,
  UseMosaicChartEditorReturn,
} from './editor/types';

// Chart builder sub-components (also accessible via ChartBuilder.*)
export {ChartBuilderDialog} from './chart-builders/ChartBuilderDialog';
export type {ChartBuilderDialogProps} from './chart-builders/ChartBuilderDialog';
export {FieldSelectorInput} from './chart-builders/FieldSelectorInput';
export type {FieldSelectorInputProps} from './chart-builders/FieldSelectorInput';
export {createDefaultChartBuilders} from './chart-builders/builders';
export type {
  MosaicChartBuilder,
  MosaicChartBuilderField,
  ChartBuilderColumn,
} from './chart-builders/types';
