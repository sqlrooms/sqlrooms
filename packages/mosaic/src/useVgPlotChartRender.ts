import {Param, Selection} from '@uwdata/mosaic-core';
import {astToDOM, parseSpec, Spec} from '@uwdata/mosaic-spec';
import {useEffect, useRef} from 'react';
import {PlotSize} from './ResponsivePlot';
import {RetainedVgPlotChart} from './useVgPlotChartRetention';

type PlotDomElement = HTMLElement | SVGSVGElement;

type PlotInstance = {
  marks?: Array<{destroy?: () => void}>;
  render?: () => Promise<unknown> | unknown;
  setAttribute?: (name: string, value: unknown) => boolean;
};

function getPlotInstance(element: object): PlotInstance | null {
  const plot = (element as HTMLElement & {value?: unknown}).value;
  return plot && typeof plot === 'object' ? (plot as PlotInstance) : null;
}

function resizeChartElement(element: object, size: PlotSize): boolean {
  const plot = getPlotInstance(element);
  if (!plot?.setAttribute || !plot.render) {
    return false;
  }

  const widthChanged = plot.setAttribute('width', size.width);
  const heightChanged = plot.setAttribute('height', size.height);
  if (widthChanged || heightChanged) {
    void plot.render();
  }
  return true;
}

async function createSpecChartElement(
  spec: Spec,
  size: PlotSize,
  params?: Map<string, Param<any> | Selection>,
): Promise<PlotDomElement> {
  const sizedSpec = {
    ...spec,
    width: size.width,
    height: size.height,
  } as Spec;

  const ast = await parseSpec(sizedSpec);
  const options = params
    ? {params: params as unknown as Map<string, Param<any>>}
    : undefined;

  return (await astToDOM(ast, options)).element;
}

function asPlotDomElement(element: object): PlotDomElement {
  return element as PlotDomElement;
}

type UseVgPlotChartRenderParams = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  spec: Spec;
  specKey: string | null;
  params?: Map<string, Param<any> | Selection>;
  containerSize: PlotSize | null;
  cachedChart: RetainedVgPlotChart | null;
  onChartCreated: (chart: RetainedVgPlotChart) => void;
  onError: (error: Error) => void;
};

/**
 * Hook to handle chart rendering lifecycle: creating, caching, and displaying vgplot charts.
 */
export function useVgPlotChartRender({
  containerRef,
  spec,
  specKey,
  params,
  containerSize,
  cachedChart,
  onChartCreated,
  onError,
}: UseVgPlotChartRenderParams) {
  const renderVersionRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !containerSize) {
      return;
    }

    // Use cached chart if available
    if (cachedChart) {
      container.replaceChildren(asPlotDomElement(cachedChart.element));
      resizeChartElement(cachedChart.element, containerSize);

      // Restore error state from cached chart
      if (cachedChart.error) {
        onError(cachedChart.error);
      }

      return;
    }

    // Create new chart
    const renderVersion = ++renderVersionRef.current;
    let cancelled = false;

    void createSpecChartElement(spec, containerSize, params)
      .then((element) => {
        if (
          cancelled ||
          renderVersion !== renderVersionRef.current ||
          !containerRef.current
        ) {
          return;
        }

        const nextChart: RetainedVgPlotChart = {
          element,
          params,
          specKey: specKey ?? JSON.stringify(spec),
        };

        onChartCreated(nextChart);
        containerRef.current.replaceChildren(element);

        // Wrap marks queryError to catch runtime errors
        const plot = getPlotInstance(element);
        if (plot?.marks) {
          plot.marks.forEach((mark: any) => {
            if (mark.queryError) {
              const originalQueryError = mark.queryError;
              mark.queryError = (error: any) => {
                // Call onError to display error in UI
                onError(error);
                // Update cached chart with error
                nextChart.error = error;
                // Call original to maintain Mosaic's internal state
                originalQueryError.call(mark, error);
              };
            }
          });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        onError(error);
        console.error('[VgPlotChart] Error rendering chart:', error);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize, specKey, cachedChart, onChartCreated, onError]);
}
