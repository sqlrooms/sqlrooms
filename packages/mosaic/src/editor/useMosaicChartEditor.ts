import {Spec} from '@uwdata/mosaic-spec';
import {useEffect, useMemo, useState} from 'react';
import {safeJsonParse} from '@sqlrooms/utils';
import {
  MosaicEditorActions,
  MosaicEditorState,
  UseMosaicChartEditorOptions,
  UseMosaicChartEditorReturn,
} from './types';

/**
 * Hook for managing Mosaic chart editor state.
 *
 * Provides local state management with debounced spec parsing for live preview,
 * and external callbacks for persisting changes.
 */
export function useMosaicChartEditor({
  initialSpec,
  onSpecChange,
}: UseMosaicChartEditorOptions): UseMosaicChartEditorReturn {
  const normalizeInitialSpec = (spec: Spec | string) => {
    if (typeof spec === 'string') {
      const parsed = safeJsonParse(spec) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return {
          parsed: parsed as Spec,
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

  const [editorState, setEditorState] = useState(() => ({
    editedSpecString: initialSpecState.formatted,
    appliedSpecString: initialSpecState.normalized,
    originalSpecString: initialSpecState.formatted,
    prevInitialSpecString: initialSpecState.normalized,
    lastValidSpec: initialSpecState.parsed ?? ({} as unknown as Spec),
  }));

  // Detect prop changes during render
  const currentInitialSpec = normalizeInitialSpec(initialSpec);
  if (currentInitialSpec.normalized !== editorState.prevInitialSpecString) {
    setEditorState((prev) => ({
      ...prev,
      prevInitialSpecString: currentInitialSpec.normalized,
      appliedSpecString: currentInitialSpec.normalized,
      editedSpecString: currentInitialSpec.formatted,
      lastValidSpec: currentInitialSpec.parseOk
        ? (currentInitialSpec.parsed as Spec)
        : prev.lastValidSpec,
    }));
  }

  const {editedSpecString, appliedSpecString} = editorState;

  // Debounced spec parsing for live preview
  const [debouncedSpecString, setDebouncedSpecString] =
    useState(editedSpecString);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSpecString(editedSpecString);
    }, 300);
    return () => clearTimeout(timer);
  }, [editedSpecString]);

  const {parsedSpec, specParseError} = useMemo((): {
    parsedSpec: Spec | null;
    specParseError: string | null;
  } => {
    try {
      const parsed = JSON.parse(debouncedSpecString) as Spec;
      return {parsedSpec: parsed, specParseError: null};
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid JSON';
      return {parsedSpec: null, specParseError: message};
    }
  }, [debouncedSpecString]);

  if (parsedSpec && parsedSpec !== editorState.lastValidSpec) {
    setEditorState((prev) => ({...prev, lastValidSpec: parsedSpec}));
  }
  const lastValidSpec = editorState.lastValidSpec;

  const isSpecDirty = useMemo(() => {
    try {
      const currentNormalized = JSON.stringify(JSON.parse(editedSpecString));
      return currentNormalized !== appliedSpecString;
    } catch {
      return true;
    }
  }, [editedSpecString, appliedSpecString]);

  const hasChanges = isSpecDirty;
  const canApply = hasChanges && !specParseError;

  const actions: MosaicEditorActions = useMemo(
    () => ({
      setEditedSpec: (spec: string) => {
        setEditorState((prev) => ({...prev, editedSpecString: spec}));
      },

      applyChanges: () => {
        if (!parsedSpec) return;

        const newAppliedSpecString = JSON.stringify(parsedSpec);

        if (isSpecDirty) {
          onSpecChange?.(parsedSpec);
        }

        setEditorState((prev) => ({
          ...prev,
          appliedSpecString: isSpecDirty
            ? newAppliedSpecString
            : prev.appliedSpecString,
          prevInitialSpecString: isSpecDirty
            ? newAppliedSpecString
            : prev.prevInitialSpecString,
        }));
      },

      cancelChanges: () => {
        setEditorState((prev) => {
          try {
            const appliedSpec = JSON.parse(prev.appliedSpecString);
            return {
              ...prev,
              editedSpecString: JSON.stringify(appliedSpec, null, 2),
            };
          } catch {
            return {
              ...prev,
              editedSpecString: prev.appliedSpecString,
            };
          }
        });
      },

      resetToOriginal: () => {
        setEditorState((prev) => {
          try {
            const originalSpec = JSON.parse(prev.originalSpecString) as Spec;
            const originalSpecNormalized = JSON.stringify(originalSpec);

            onSpecChange?.(originalSpec);

            return {
              ...prev,
              editedSpecString: prev.originalSpecString,
              appliedSpecString: originalSpecNormalized,
              prevInitialSpecString: originalSpecNormalized,
            };
          } catch {
            return prev;
          }
        });
      },
    }),
    [parsedSpec, isSpecDirty, onSpecChange],
  );

  const state: MosaicEditorState = {
    editedSpecString,
    parsedSpec,
    lastValidSpec,
    specParseError,
    isSpecDirty,
  };

  return {
    state,
    actions,
    parsedSpec,
    canApply,
    hasChanges,
  };
}
