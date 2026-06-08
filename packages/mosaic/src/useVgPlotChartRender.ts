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
  queryPending?: () => unknown;
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

function attachPlotElement(container: HTMLElement, element: PlotDomElement) {
  if (container.childNodes.length === 1 && container.firstChild === element) {
    return;
  }
  container.replaceChildren(element);
}

function checkAndReportAggregateState(
  chart: RetainedVgPlotChart,
  onError: (error: Error) => void,
  runtimeIssueReporter: ChartRuntimeIssueReporter | undefined,
  runtimeIssueContext: ChartRuntimeIssueContext | undefined,
  dataPolicy: ChartDataPolicy | null | undefined,
) {
  if (!chart.markStates || chart.markStates.size === 0) {
    return; // No marks tracked yet
  }

  // Check if all marks are done (no pending)
  const allDone = Array.from(chart.markStates.values()).every(
    (state) => state !== 'pending',
  );

  if (!allDone) {
    return; // Wait for all marks to finish
  }

  // All marks done - determine aggregate state
  const hasError = Array.from(chart.markStates.values()).some(
    (state) => state === 'error',
  );

  if (hasError) {
    // Find first error
    const firstErrorMark = Array.from(chart.markStates.entries()).find(
      ([, state]) => state === 'error',
    )?.[0];
    const error = firstErrorMark && chart.markErrors?.get(firstErrorMark);

    if (error) {
      chart.error = error; // For standalone case
      onError(error);
      if (runtimeIssueContext) {
        runtimeIssueReporter?.reportIssue(
          createChartRuntimeIssueFromError(
            error,
            runtimeIssueContext,
            dataPolicy,
          ),
        );
      }
    }
  } else {
    // All successful
    delete chart.error;
    runtimeIssueReporter?.clearIssue();
  }
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

  // Initialize tracking
  if (!chart.markStates) {
    chart.markStates = new Map();
  }
  if (!chart.markErrors) {
    chart.markErrors = new Map();
  }

  plot.marks.forEach((mark: QueryableMark) => {
    // Wrap queryPending
    if (mark.queryPending) {
      const originalPending = mark.queryPending;
      mark.queryPending = function (this: QueryableMark) {
        chart.markStates!.set(mark, 'pending');
        return originalPending.call(this);
      };
    }

    // Wrap queryResult
    if (mark.queryResult) {
      const originalQueryResult = mark.queryResult;
      mark.queryResult = function (this: QueryableMark, data: unknown) {
        try {
          assertChartDataPolicy(dataPolicy, data);
          chart.markStates!.set(mark, 'success');
          chart.markErrors!.delete(mark);
          checkAndReportAggregateState(
            chart,
            onError,
            runtimeIssueReporter,
            runtimeIssueContext,
            dataPolicy,
          );
          return originalQueryResult.call(this, data);
        } catch (error) {
          const normalizedError =
            error instanceof Error ? error : new Error(String(error));
          chart.markStates!.set(mark, 'error');
          chart.markErrors!.set(mark, normalizedError);
          checkAndReportAggregateState(
            chart,
            onError,
            runtimeIssueReporter,
            runtimeIssueContext,
            dataPolicy,
          );
          if (mark.queryError) {
            return mark.queryError(normalizedError);
          }
          return undefined;
        }
      };
    }

    // Wrap queryError
    if (mark.queryError) {
      const originalQueryError = mark.queryError;
      mark.queryError = function (this: QueryableMark, error: unknown) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));

        chart.markStates?.set(mark, 'error');
        chart.markErrors?.set(mark, normalizedError);

        checkAndReportAggregateState(
          chart,
          onError,
          runtimeIssueReporter,
          runtimeIssueContext,
          dataPolicy,
        );
        originalQueryError.call(this, error);
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
      // Clear mark states when reusing cached chart - marks will re-register on next query
      if (cachedChart.markStates) {
        cachedChart.markStates.clear();
      }
      if (cachedChart.markErrors) {
        cachedChart.markErrors.clear();
      }
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

      // Restore aggregate error state from cached chart's mark states
      checkAndReportAggregateState(
        cachedChart,
        onError,
        runtimeIssueReporter,
        runtimeIssueContext,
        dataPolicy,
      );

      return;
    }

    if (!containerSize) {
      return;
    }

    // Clear any previous runtime issues when starting to render a new chart spec
    // This ensures stale errors don't persist when the chart configuration changes
    runtimeIssueReporter?.clearIssue();

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
