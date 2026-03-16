import {Spec} from '@uwdata/mosaic-spec';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {safeJsonParse} from '@sqlrooms/utils';
import {
  MosaicEditorActions,
  MosaicEditorState,
  UseMosaicChartEditorOptions,
  UseMosaicChartEditorReturn,
} from './types';

function normalizeInitialSpec(spec: Spec | string) {
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
}

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

  // Debounced spec parsing for live preview.
  // Only update parsedSpec/specParseError after the user stops typing.
  const [debouncedParsed, setDebouncedParsed] = useState<{
    parsedSpec: Spec | null;
    specParseError: string | null;
    normalized: string | null;
  }>(() => {
    try {
      const parsed = JSON.parse(editedSpecString) as Spec;
      return {
        parsedSpec: parsed,
        specParseError: null,
        normalized: JSON.stringify(parsed),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid JSON';
      return {parsedSpec: null, specParseError: message, normalized: null};
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedParsed((prev) => {
        try {
          const parsed = JSON.parse(editedSpecString) as Spec;
          const normalized = JSON.stringify(parsed);
          if (normalized === prev.normalized) {
            return prev;
          }
          return {parsedSpec: parsed, specParseError: null, normalized};
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Invalid JSON';
          if (prev.specParseError === message) {
            return prev;
          }
          return {
            parsedSpec: null,
            specParseError: message,
            normalized: prev.normalized,
          };
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [editedSpecString]);

  const {parsedSpec, specParseError} = debouncedParsed;

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

  const onSpecChangeRef = useRef(onSpecChange);
  useEffect(() => {
    onSpecChangeRef.current = onSpecChange;
  });

  const setEditedSpec = useCallback((spec: string) => {
    setEditorState((prev) => ({...prev, editedSpecString: spec}));
  }, []);

  const applyChanges = useCallback(() => {
    setDebouncedParsed((currentParsed) => {
      if (!currentParsed.parsedSpec) return currentParsed;

      const newAppliedSpecString = JSON.stringify(currentParsed.parsedSpec);

      setEditorState((prev) => {
        const dirty = (() => {
          try {
            return (
              JSON.stringify(JSON.parse(prev.editedSpecString)) !==
              prev.appliedSpecString
            );
          } catch {
            return true;
          }
        })();

        if (dirty) {
          onSpecChangeRef.current?.(currentParsed.parsedSpec!);
        }

        return {
          ...prev,
          appliedSpecString: dirty
            ? newAppliedSpecString
            : prev.appliedSpecString,
          prevInitialSpecString: dirty
            ? newAppliedSpecString
            : prev.prevInitialSpecString,
        };
      });

      return currentParsed;
    });
  }, []);

  const cancelChanges = useCallback(() => {
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
  }, []);

  const resetToOriginal = useCallback(() => {
    setEditorState((prev) => {
      try {
        const originalSpec = JSON.parse(prev.originalSpecString) as Spec;
        const originalSpecNormalized = JSON.stringify(originalSpec);

        onSpecChangeRef.current?.(originalSpec);

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
  }, []);

  const actions: MosaicEditorActions = useMemo(
    () => ({setEditedSpec, applyChanges, cancelChanges, resetToOriginal}),
    [setEditedSpec, applyChanges, cancelChanges, resetToOriginal],
  );

  const state: MosaicEditorState = useMemo(
    () => ({
      editedSpecString,
      parsedSpec,
      lastValidSpec,
      specParseError,
      isSpecDirty,
    }),
    [editedSpecString, parsedSpec, lastValidSpec, specParseError, isSpecDirty],
  );

  return {
    state,
    actions,
    parsedSpec,
    canApply,
    hasChanges,
  };
}
