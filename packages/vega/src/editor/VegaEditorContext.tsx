import {createContext, useContext} from 'react';
import {VegaEditorContextValue} from './types';

/**
 * Context for sharing editor state between compound components
 */
export const VegaEditorContext = createContext<VegaEditorContextValue | null>(
  null,
);

/**
 * Hook to access the Vega editor context.
 * Must be used within a VegaLiteChart.Container component.
 *
 * @throws Error if used outside of VegaLiteChart.Container
 */
export function useVegaEditorContext(): VegaEditorContextValue {
  const ctx = useContext(VegaEditorContext);
  if (!ctx) {
    throw new Error(
      'useVegaEditorContext must be used within VegaLiteChart.Container',
    );
  }
  return ctx;
}
