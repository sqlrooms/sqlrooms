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
  type CreateMosaicSliceProps,
  type MosaicClientOptions,
  type MosaicSliceState,
  type TrackedClient,
} from './MosaicSlice';
export {useMosaicClient, type UseMosaicClientOptions} from './useMosaicClient';
export {VgPlotChart} from './VgPlotChart';

// Compound components
export {MosaicChart} from './MosaicChart';
export {MosaicChartBuilder} from './MosaicChartBuilder';

// Editor hooks and context
export {useMosaicChartEditor} from './editor/useMosaicChartEditor';
export {useMosaicEditorContext} from './editor/MosaicEditorContext';
export {
  loadMosaicSchema,
  getCachedMosaicSchema,
  preloadMosaicSchema,
} from './editor/mosaicSchema';

// Editor types
export type {MosaicChartContainerProps} from './editor/MosaicChartContainer';
export type {MosaicChartDisplayProps} from './editor/MosaicChartDisplay';
export type {MosaicSpecEditorPanelProps} from './editor/MosaicSpecEditorPanel';
export type {MosaicChartEditorActionsProps} from './editor/MosaicChartEditorActions';
export type {MosaicCodeMirrorEditorProps} from './editor/MosaicCodeMirrorEditor';
export type {
  MosaicEditorState,
  MosaicEditorActions,
  MosaicEditorContextValue,
  OnMosaicSpecChange,
  UseMosaicChartEditorOptions,
  UseMosaicChartEditorReturn,
} from './editor/types';

// Chart builder types and utilities
export type {ChartBuilderDialogProps} from './chart-builders/ChartBuilderDialog';
export type {ChartBuilderContentProps} from './chart-builders/ChartBuilderContent';
export type {FieldSelectorInputProps} from './chart-builders/FieldSelectorInput';
export {createDefaultChartBuilders} from './chart-builders/builders';
export type {
  ChartBuilderTemplate,
  ChartBuilderField,
  ChartBuilderColumn,
} from './chart-builders/types';
