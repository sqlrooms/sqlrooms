import * as arrow from 'apache-arrow';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';

/**
 * Editor mode determines which editors are shown
 */
export type EditorMode = 'spec' | 'sql' | 'both' | 'none';

/**
 * Callback when spec changes are applied
 */
export type OnSpecChange = (newSpec: VisualizationSpec) => void;

/**
 * Callback when SQL query changes are applied
 */
export type OnSqlChange = (newSql: string) => void;

/**
 * State managed by the editor
 */
export interface VegaEditorState {
  /** The edited spec as a JSON string */
  editedSpecString: string;
  /** The edited SQL query */
  editedSql: string;
  /** The last applied SQL query (for chart rendering) */
  appliedSql: string;
  /** Parsed spec object (null if parse error) */
  parsedSpec: VisualizationSpec | null;
  /** Last successfully parsed spec (for fallback during errors) */
  lastValidSpec: VisualizationSpec;
  /** JSON parse error message if any */
  specParseError: string | null;
  /** Whether spec has been modified from initial */
  isSpecDirty: boolean;
  /** Whether SQL has been modified from initial */
  isSqlDirty: boolean;
}

/**
 * Actions available in the editor
 */
export interface VegaEditorActions {
  /** Update the edited spec string */
  setEditedSpec: (spec: string) => void;
  /** Update the edited SQL query */
  setEditedSql: (sql: string) => void;
  /** Apply all changes (calls onSpecChange/onSqlChange callbacks) */
  applyChanges: () => void;
  /** Cancel changes and revert to last applied state */
  cancelChanges: () => void;
  /** Reset to original initial values */
  resetToOriginal: () => void;
}

/**
 * Context value provided by VegaLiteChart.Container
 */
export interface VegaEditorContextValue {
  // State
  state: VegaEditorState;
  actions: VegaEditorActions;

  // Config
  /** Whether editing is enabled */
  editable: boolean;
  /** Initial SQL query (if using SQL data source) */
  sqlQuery: string | undefined;
  /** Arrow table data (alternative to sqlQuery) */
  arrowTable: arrow.Table | undefined;
  /** Vega embed options */
  options: EmbedOptions | undefined;

  // Derived
  /** Whether apply is possible (no errors, has changes) */
  canApply: boolean;
  /** Whether there are any unsaved changes */
  hasChanges: boolean;
}

/**
 * Props for the useVegaChartEditor hook
 */
export interface UseVegaChartEditorOptions {
  /** Initial Vega-Lite spec */
  initialSpec: VisualizationSpec;
  /** Initial SQL query */
  initialSql?: string;
  /** Callback when spec changes are applied */
  onSpecChange?: OnSpecChange;
  /** Callback when SQL changes are applied */
  onSqlChange?: OnSqlChange;
}

/**
 * Return type for useVegaChartEditor hook
 */
export interface UseVegaChartEditorReturn {
  state: VegaEditorState;
  actions: VegaEditorActions;
  /** Parsed spec ready for rendering (null if parse error) */
  parsedSpec: VisualizationSpec | null;
  /** Whether apply button should be enabled */
  canApply: boolean;
  /** Whether there are any unsaved changes */
  hasChanges: boolean;
}
