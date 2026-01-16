/**
 * Composable Vega-Lite chart editor components
 * @module editor
 */

// Types
export type {
  EditorMode,
  OnSpecChange,
  OnSqlChange,
  UseVegaChartEditorOptions,
  UseVegaChartEditorReturn,
  VegaEditorActions,
  VegaEditorContextValue,
  VegaEditorState,
} from './types';

// Context
export {useVegaEditorContext, VegaEditorContext} from './VegaEditorContext';

// Hook
export {useVegaChartEditor} from './useVegaChartEditor';

// Components
export {VegaChartContainer} from './VegaChartContainer';
export type {VegaChartContainerProps} from './VegaChartContainer';

export {VegaChartDisplay} from './VegaChartDisplay';
export type {VegaChartDisplayProps} from './VegaChartDisplay';

export {VegaMonacoEditor} from './VegaMonacoEditor';
export type {VegaMonacoEditorProps} from './VegaMonacoEditor';

export {VegaSpecEditorPanel} from './VegaSpecEditorPanel';
export type {VegaSpecEditorPanelProps} from './VegaSpecEditorPanel';

export {VegaSqlEditorPanel} from './VegaSqlEditorPanel';
export type {VegaSqlEditorPanelProps} from './VegaSqlEditorPanel';

export {VegaChartEditorActions} from './VegaChartEditorActions';
export type {VegaChartEditorActionsProps} from './VegaChartEditorActions';
