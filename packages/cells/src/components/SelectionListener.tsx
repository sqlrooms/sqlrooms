import {SignalListenerHandler, useVegaChartContext} from '@sqlrooms/vega';
import React, {useEffect, useRef} from 'react';
import {useCellsStore} from '../hooks';
import type {BrushFieldType, CrossFilterSelection, VegaCell} from '../types';
import {BRUSH_PARAM_NAME} from '../vegaSelectionUtils';
import {useVegaCrossFilterOptions} from '../hooks/useVegaCrossFilterOptions';

type SelectionListenerProps = {
  cell: VegaCell;
};

/**
 * Converts Vega selection signal value to CrossFilterSelection.
 * Returns null if the selection is invalid or should be cleared.
 */
function buildCrossFilterSelection(
  brushField: string,
  brushFieldType: BrushFieldType | undefined,
  fieldValue: any,
): CrossFilterSelection | null {
  if (!Array.isArray(fieldValue)) {
    return null;
  }

  // String fields use point selection - return array of selected values
  if (brushFieldType === 'string') {
    if (fieldValue.length > 0) {
      return {
        field: brushField,
        fieldType: brushFieldType,
        type: 'point',
        value: fieldValue,
      };
    }
    return null;
  }

  // Numeric/temporal/boolean fields use interval selection
  // With proper type encodings, Vega always returns [min, max]
  if (fieldValue.length === 2) {
    return {
      field: brushField,
      fieldType: brushFieldType,
      type: 'interval',
      value: fieldValue,
    };
  }

  // Invalid interval - clear selection
  return null;
}

/**
 * Attaches a debounced Vega signal listener for the brush param
 * and reports selection changes to the cross-filter state.
 */
export const SelectionListener: React.FC<SelectionListenerProps> = ({cell}) => {
  const {id: cellId} = cell;
  const selectedSqlId = cell.data.sqlId!;
  const {brushField, brushFieldType} = useVegaCrossFilterOptions(cell);

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
        if (!value || Object.keys(value).length === 0 || !brushField) {
          setCrossFilterSelection(cellId, selectedSqlId, null);
          return;
        }

        const fieldValue = value.x ?? value[brushField];
        const selection = buildCrossFilterSelection(
          brushField,
          brushFieldType,
          fieldValue,
        );
        setCrossFilterSelection(cellId, selectedSqlId, selection);
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
      setCrossFilterSelection(cellId, selectedSqlId, null);
    };
  }, [
    embed,
    cellId,
    brushField,
    brushFieldType,
    setCrossFilterSelection,
    selectedSqlId,
  ]);

  return null;
};
