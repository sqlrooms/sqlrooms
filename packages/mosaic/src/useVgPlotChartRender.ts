import {Param, Selection} from '@uwdata/mosaic-core';
import {astToDOM, parseSpec, Spec} from '@uwdata/mosaic-spec';
import {useLayoutEffect, useRef} from 'react';
import {PlotSize} from './ResponsivePlot';
import {RetainedVgPlotChart} from './useVgPlotChartRetention';
import {
  assertChartDataPolicy,
  createChartRuntimeIssueFromError,
  type ChartDataPolicy,
  type ChartRuntimeIssueContext,
  type ChartRuntimeIssueReporter,
} from './chart-runtime';

type PlotDomElement = HTMLElement | SVGSVGElement;

type QueryableMark = {
  queryResult?: (data: unknown) => unknown;
  queryError?: (error: unknown) => unknown;
};

type PlotInstance = {
  marks?: Array<{destroy?: () => void} & QueryableMark>;
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

function attachPlotElement(
  container: HTMLElement,
  element: PlotDomElement,
) {
  if (container.childNodes.length === 1 && container.firstChild === element) {
    return;
  }
  container.replaceChildren(element);
}

function wrapMarkHandlers(
  chart: RetainedVgPlotChart,
  onError: (error: Error) => void,
  dataPolicy?: ChartDataPolicy | null,
  runtimeIssueContext?: ChartRuntimeIssueContext,
  runtimeIssueReporter?: ChartRuntimeIssueReporter,
) {
  const plot = getPlotInstance(chart.element);
  if (!plot?.marks) {
    return;
  }

  plot.marks.forEach((mark: QueryableMark) => {
    if (mark.queryResult) {
      const originalQueryResult = mark.queryResult;
      mark.queryResult = (data: unknown) => {
        try {
          assertChartDataPolicy(dataPolicy, data);
          runtimeIssueReporter?.clearIssue();
          return originalQueryResult.call(mark, data);
        } catch (error) {
          const normalizedError =
            error instanceof Error ? error : new Error(String(error));
          onError(normalizedError);
          chart.error = normalizedError;
          if (runtimeIssueContext) {
            runtimeIssueReporter?.reportIssue(
              createChartRuntimeIssueFromError(
                normalizedError,
                runtimeIssueContext,
                dataPolicy,
              ),
            );
          }
          if (mark.queryError) {
            return mark.queryError(normalizedError);
          }
          return undefined;
        }
      };
    }
    if (mark.queryError) {
      const originalQueryError = mark.queryError;
      mark.queryError = (error: unknown) => {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        onError(normalizedError);
        chart.error = normalizedError;
        if (runtimeIssueContext) {
          runtimeIssueReporter?.reportIssue(
            createChartRuntimeIssueFromError(
              normalizedError,
              runtimeIssueContext,
              dataPolicy,
            ),
          );
        }
        originalQueryError.call(mark, error);
      };
    }
  });
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
  dataPolicy?: ChartDataPolicy | null;
  runtimeIssueContext?: ChartRuntimeIssueContext;
  runtimeIssueReporter?: ChartRuntimeIssueReporter;
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
  dataPolicy,
  runtimeIssueContext,
  runtimeIssueReporter,
}: UseVgPlotChartRenderParams) {
  const renderVersionRef = useRef(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (cachedChart) {
      attachPlotElement(container, asPlotDomElement(cachedChart.element));
      if (containerSize) {
        resizeChartElement(cachedChart.element, containerSize);
      }

      // Re-wrap mark handlers with fresh closures for dataPolicy/runtimeIssue reporting
      wrapMarkHandlers(
        cachedChart,
        onError,
        dataPolicy,
        runtimeIssueContext,
        runtimeIssueReporter,
      );

      // Restore error state from cached chart
      if (cachedChart.error) {
        onError(cachedChart.error);
      }

      return;
    }

    if (!containerSize) {
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
        attachPlotElement(containerRef.current, element);

        // Wrap marks with runtime handlers
        wrapMarkHandlers(
          nextChart,
          onError,
          dataPolicy,
          runtimeIssueContext,
          runtimeIssueReporter,
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        // Normalize error to Error instance
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        onError(normalizedError);
        if (runtimeIssueContext) {
          runtimeIssueReporter?.reportIssue({
            kind: 'render-error',
            panelId: runtimeIssueContext.panelId,
            chartType: runtimeIssueContext.chartType,
            message: normalizedError.message,
            recoverable: false,
          });
        }
        console.error('[VgPlotChart] Error rendering chart:', normalizedError);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    containerSize,
    specKey,
    cachedChart,
    onChartCreated,
    onError,
    dataPolicy,
    runtimeIssueContext,
    runtimeIssueReporter,
  ]);
}
