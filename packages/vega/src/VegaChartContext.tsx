import {createContext, useContext} from 'react';
import {Result} from 'vega-embed';

/**
 * Context value for VegaLiteArrowChart, providing access to the embed result.
 */
export interface VegaChartContextValue {
  /**
   * The Vega embed result, providing access to the Vega view for export operations.
   * Will be null until the chart is rendered.
   */
  embed: Result | null;
}

const VegaChartContext = createContext<VegaChartContextValue | null>(null);

/**
 * Hook to access the Vega chart context within action components.
 *
 * @example
 * ```tsx
 * function CustomExportAction() {
 *   const { embed } = useVegaChartContext();
 *
 *   const handleExport = async () => {
 *     if (!embed?.view) return;
 *     const canvas = await embed.view.toCanvas(2);
 *     // Do something with the canvas...
 *   };
 *
 *   return <Button onClick={handleExport}>Export</Button>;
 * }
 * ```
 *
 * @throws Error if used outside of VegaLiteArrowChart
 */
export function useVegaChartContext(): VegaChartContextValue {
  const ctx = useContext(VegaChartContext);
  if (!ctx) {
    throw new Error(
      'useVegaChartContext must be used within VegaLiteArrowChart',
    );
  }
  return ctx;
}

export const VegaChartContextProvider = VegaChartContext.Provider;
