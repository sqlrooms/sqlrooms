import {useEffect, useMemo, useState} from 'react';
import {VisualizationSpec} from 'vega-embed';
import {safeJsonParse} from '@sqlrooms/utils';
import {
  UseVegaChartEditorOptions,
  UseVegaChartEditorReturn,
  VegaEditorActions,
  VegaEditorState,
} from './types';

/**
 * Hook for managing Vega chart editor state.
 *
 * Provides local state management with debounced spec parsing for live preview,
 * and external callbacks for persisting changes.
 *
 * @example
 * ```tsx
 * const { state, actions, parsedSpec, canApply } = useVegaChartEditor({
 *   initialSpec: mySpec,
 *   initialSql: myQuery,
 *   onSpecChange: (spec) => saveSpec(spec),
 *   onSqlChange: (sql) => saveQuery(sql),
 * });
 * ```
 */
export function useVegaChartEditor({
  initialSpec,
  initialSql = '',
  onSpecChange,
  onSqlChange,
}: UseVegaChartEditorOptions): UseVegaChartEditorReturn {
  const normalizeInitialSpec = (spec: VisualizationSpec | string) => {
    if (typeof spec === 'string') {
      const parsed = safeJsonParse(spec) as VisualizationSpec | null;
      if (parsed) {
        return {
          parsed,
          normalized: JSON.stringify(parsed),
          formatted: JSON.stringify(parsed, null, 2),
          parseOk: true,
        };
      }
      return {
        parsed: null,
        normalized: spec,
        formatted: spec,
        parseOk: false,
      };
    }

    return {
      parsed: spec,
      normalized: JSON.stringify(spec),
      formatted: JSON.stringify(spec, null, 2),
      parseOk: true,
    };
  };

  const initialSpecState = normalizeInitialSpec(initialSpec);

  // Combined editing state to allow atomic updates
  // All values stored in state to avoid ref updates during render
  const [editorState, setEditorState] = useState(() => {
    return {
      editedSpecString: initialSpecState.formatted,
      editedSql: initialSql,
      appliedSpecString: initialSpecState.normalized,
      appliedSql: initialSql,
      // Original values for reset functionality
      originalSpecString: initialSpecState.formatted,
      originalSql: initialSql,
      // Track previous prop values for change detection
      prevInitialSpecString: initialSpecState.normalized,
      prevInitialSql: initialSql,
      // Track last successfully parsed spec for fallback during errors
      lastValidSpec:
        initialSpecState.parsed ?? ({} as unknown as VisualizationSpec),
    };
  });

  // Detect prop changes during render (React-recommended pattern)
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const currentInitialSpec = normalizeInitialSpec(initialSpec);
  if (currentInitialSpec.normalized !== editorState.prevInitialSpecString) {
    setEditorState((prev) => ({
      ...prev,
      prevInitialSpecString: currentInitialSpec.normalized,
      appliedSpecString: currentInitialSpec.normalized,
      editedSpecString: currentInitialSpec.formatted,
      lastValidSpec: currentInitialSpec.parseOk
        ? (currentInitialSpec.parsed as VisualizationSpec)
        : prev.lastValidSpec,
    }));
  }

  if (initialSql !== editorState.prevInitialSql) {
    setEditorState((prev) => ({
      ...prev,
      prevInitialSql: initialSql,
      appliedSql: initialSql,
      editedSql: initialSql,
    }));
  }

  const {editedSpecString, editedSql, appliedSpecString, appliedSql} =
    editorState;

  // Debounced spec parsing for live preview
  const [debouncedSpecString, setDebouncedSpecString] =
    useState(editedSpecString);

  // Debounce the spec string
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSpecString(editedSpecString);
    }, 300);
    return () => clearTimeout(timer);
  }, [editedSpecString]);

  // Parse the debounced spec string and derive error
  const {parsedSpec, specParseError} = useMemo((): {
    parsedSpec: VisualizationSpec | null;
    specParseError: string | null;
  } => {
    try {
      const parsed = JSON.parse(debouncedSpecString) as VisualizationSpec;
      return {parsedSpec: parsed, specParseError: null};
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid JSON';
      return {parsedSpec: null, specParseError: message};
    }
  }, [debouncedSpecString]);

  // Update lastValidSpec when we successfully parse a new spec (render-time pattern)
  if (parsedSpec && parsedSpec !== editorState.lastValidSpec) {
    setEditorState((prev) => ({...prev, lastValidSpec: parsedSpec}));
  }
  const lastValidSpec = editorState.lastValidSpec;

  // Calculate dirty state
  const isSpecDirty = useMemo(() => {
    try {
      const currentNormalized = JSON.stringify(JSON.parse(editedSpecString));
      return currentNormalized !== appliedSpecString;
    } catch {
      return true; // If parse fails, consider it dirty
    }
  }, [editedSpecString, appliedSpecString]);

  const isSqlDirty = editedSql !== appliedSql;

  // Derived state
  const hasChanges = isSpecDirty || isSqlDirty;
  const canApply = hasChanges && !specParseError;

  // Actions
  const actions: VegaEditorActions = useMemo(
    () => ({
      setEditedSpec: (spec: string) => {
        setEditorState((prev) => ({...prev, editedSpecString: spec}));
      },

      setEditedSql: (sql: string) => {
        setEditorState((prev) => ({...prev, editedSql: sql}));
      },

      applyChanges: () => {
        if (!parsedSpec) return;

        const newAppliedSpecString = JSON.stringify(parsedSpec);

        // Notify callbacks
        if (isSpecDirty) {
          onSpecChange?.(parsedSpec);
        }

        if (isSqlDirty) {
          onSqlChange?.(editedSql);
        }

        // Update state atomically, including prevInitial* to mark these as "seen"
        // so prop changes from parent echoing our update won't trigger a reset
        setEditorState((prev) => ({
          ...prev,
          appliedSpecString: isSpecDirty
            ? newAppliedSpecString
            : prev.appliedSpecString,
          appliedSql: isSqlDirty ? prev.editedSql : prev.appliedSql,
          prevInitialSpecString: isSpecDirty
            ? newAppliedSpecString
            : prev.prevInitialSpecString,
          prevInitialSql: isSqlDirty ? prev.editedSql : prev.prevInitialSql,
        }));
      },

      cancelChanges: () => {
        // Revert to last applied state - need to re-format the applied spec
        setEditorState((prev) => {
          // Parse and re-format the applied spec string for display
          try {
            const appliedSpec = JSON.parse(prev.appliedSpecString);
            return {
              ...prev,
              editedSpecString: JSON.stringify(appliedSpec, null, 2),
              editedSql: prev.appliedSql,
            };
          } catch {
            // If parsing fails, just use the raw string
            return {
              ...prev,
              editedSpecString: prev.appliedSpecString,
              editedSql: prev.appliedSql,
            };
          }
        });
      },

      resetToOriginal: () => {
        setEditorState((prev) => {
          // Parse and normalize the original spec
          try {
            const originalSpec = JSON.parse(
              prev.originalSpecString,
            ) as VisualizationSpec;
            const originalSpecNormalized = JSON.stringify(originalSpec);

            // Notify callbacks
            onSpecChange?.(originalSpec);
            if (prev.originalSql !== prev.appliedSql) {
              onSqlChange?.(prev.originalSql);
            }

            return {
              ...prev,
              editedSpecString: prev.originalSpecString,
              editedSql: prev.originalSql,
              appliedSpecString: originalSpecNormalized,
              appliedSql: prev.originalSql,
              prevInitialSpecString: originalSpecNormalized,
              prevInitialSql: prev.originalSql,
            };
          } catch {
            return prev;
          }
        });
      },
    }),
    [parsedSpec, isSpecDirty, isSqlDirty, editedSql, onSpecChange, onSqlChange],
  );

  // Build state object
  const state: VegaEditorState = {
    editedSpecString,
    editedSql,
    appliedSql,
    parsedSpec,
    lastValidSpec,
    specParseError,
    isSpecDirty,
    isSqlDirty,
  };

  return {
    state,
    actions,
    parsedSpec,
    canApply,
    hasChanges,
  };
}
