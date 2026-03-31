import {SignalListenerHandler, useVegaChartContext} from '@sqlrooms/vega';
import React, {useEffect, useRef} from 'react';
import {useCellsStore} from '../hooks';
import type {CrossFilterSelection, VegaCell} from '../types';
import {BRUSH_PARAM_NAME} from '../vegaSelectionUtils';
import {useVegaCrossFilterOptions} from '../hooks/useVegaCrossFilterOptions';

type SelectionListenerProps = {
  cell: VegaCell;
};

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
        if (!value || Object.keys(value).length === 0) {
          setCrossFilterSelection(cellId, selectedSqlId, null);
          return;
        }

        if (!brushField) {
          return;
        }

        const fieldValue = value.x ?? value[brushField];

        if (Array.isArray(fieldValue)) {
          let interval: [any, any] | null = null;

          if (fieldValue.length === 2) {
            // Standard interval format [min, max]
            interval = fieldValue as [any, any];
          } else if (fieldValue.length > 2) {
            // For datetime binning, Vega returns array of all selected values
            // Extract min and max to create interval
            const sorted = [...fieldValue].sort((a, b) => {
              // Handle both numeric timestamps and ISO strings
              const aVal = typeof a === 'string' ? new Date(a).getTime() : a;
              const bVal = typeof b === 'string' ? new Date(b).getTime() : b;
              return aVal - bVal;
            });
            interval = [sorted[0], sorted[sorted.length - 1]];
          }

          if (interval) {
            const selection: CrossFilterSelection = {
              field: brushField,
              fieldType: brushFieldType,
              type: 'interval',
              value: interval,
            };
            setCrossFilterSelection(cellId, selectedSqlId, selection);
          } else {
            setCrossFilterSelection(cellId, selectedSqlId, null);
          }
        } else {
          setCrossFilterSelection(cellId, selectedSqlId, null);
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
