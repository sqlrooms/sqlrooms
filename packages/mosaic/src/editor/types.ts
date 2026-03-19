import {Param} from '@uwdata/mosaic-core';
import {Spec} from '@uwdata/mosaic-spec';

/**
 * State managed by the Mosaic spec editor
 */
export interface MosaicEditorState {
  /** The edited spec as a JSON string */
  editedSpecString: string;
  /** Parsed spec object (null if parse error) */
  parsedSpec: Spec | null;
  /** Last successfully parsed spec (for fallback during errors) */
  lastValidSpec: Spec;
  /** JSON parse error message if any */
  specParseError: string | null;
  /** Whether spec has been modified from last applied state */
  isSpecDirty: boolean;
}

/**
 * Actions available in the Mosaic spec editor
 */
export interface MosaicEditorActions {
  /** Update the edited spec string */
  setEditedSpec: (spec: string) => void;
  /** Apply all changes (calls onSpecChange callback) */
  applyChanges: () => void;
  /** Cancel changes and revert to last applied state */
  cancelChanges: () => void;
  /** Reset to original initial values */
  resetToOriginal: () => void;
}

/**
 * Callback when spec changes are applied
 */
export type OnMosaicSpecChange = (newSpec: Spec) => void;

/**
 * Context value provided by MosaicChart.Container
 */
export interface MosaicEditorContextValue {
  state: MosaicEditorState;
  actions: MosaicEditorActions;
  /** Whether editing is enabled */
  editable: boolean;
  /** Pre-defined params/selections for shared cross-filtering */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Map<string, Param<any>>;
  /** Whether apply is possible (no errors, has changes) */
  canApply: boolean;
  /** Whether there are any unsaved changes */
  hasChanges: boolean;
}

/**
 * Props for the useMosaicChartEditor hook
 */
export interface UseMosaicChartEditorOptions {
  /** Initial Mosaic spec */
  initialSpec: Spec | string;
  /** Callback when spec changes are applied */
  onSpecChange?: OnMosaicSpecChange;
}

/**
 * Return type for useMosaicChartEditor hook
 */
export interface UseMosaicChartEditorReturn {
  state: MosaicEditorState;
  actions: MosaicEditorActions;
  /** Parsed spec ready for rendering (null if parse error) */
  parsedSpec: Spec | null;
  /** Whether apply button should be enabled */
  canApply: boolean;
  /** Whether there are any unsaved changes */
  hasChanges: boolean;
}
