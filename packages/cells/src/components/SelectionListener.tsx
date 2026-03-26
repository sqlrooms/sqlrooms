import {SignalListenerHandler, useVegaChartContext} from '@sqlrooms/vega';
import React, {useEffect, useRef} from 'react';
import {useCellsStore} from '../hooks';
import type {BrushFieldType, CrossFilterSelection} from '../types';
import {BRUSH_PARAM_NAME} from '../vegaSelectionUtils';

type SelectionListenerProps = {
  cellId: string;
  sqlId: string;
  brushField: string;
  brushFieldType?: BrushFieldType;
};

/**
 * Attaches a debounced Vega signal listener for the brush param
 * and reports selection changes to the cross-filter state.
 */
export const SelectionListener: React.FC<SelectionListenerProps> = ({
  cellId,
  sqlId,
  brushField,
  brushFieldType,
}) => {
  const {embed} = useVegaChartContext();
  const setCrossFilterSelection = useCellsStore(
    (s) => s.cells.setCrossFilterSelection,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!embed?.view) {
      return;
    }

    const handler: SignalListenerHandler = (_name, value) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        if (!value || Object.keys(value).length === 0) {
          setCrossFilterSelection(cellId, sqlId, null);
          return;
        }

        const fieldValue = value.x ?? value[brushField];

        if (Array.isArray(fieldValue) && fieldValue.length === 2) {
          const selection: CrossFilterSelection = {
            field: brushField,
            fieldType: brushFieldType,
            type: 'interval',
            value: fieldValue,
          };
          setCrossFilterSelection(cellId, sqlId, selection);
        } else {
          setCrossFilterSelection(cellId, sqlId, null);
        }
      }, 200);
    };

    try {
      embed.view.addSignalListener(BRUSH_PARAM_NAME, handler);
    } catch (error) {
      // Signal doesn't exist yet (view is still rendering a spec without the brush param).
      // Will retry when embed reference changes after the new spec is compiled.
      console.warn('Failed to add signal listener:', error);
      return;
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      try {
        embed.view.removeSignalListener(BRUSH_PARAM_NAME, handler);
      } catch (error) {
        // View may have been finalized
        console.warn('Failed to remove signal listener:', error);
      }

      // Clear this chart's selection from crossFilterSelections
      setCrossFilterSelection(cellId, sqlId, null);
    };
  }, [
    embed,
    cellId,
    sqlId,
    brushField,
    brushFieldType,
    setCrossFilterSelection,
  ]);

  return null;
};
