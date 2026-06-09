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

/**
 * Symbols used to store original mark handlers before wrapping.
 * This allows wrapMarkHandlers to be idempotent - it stores the original
 * handlers once and reuses them on subsequent calls, preventing nested wrappers.
 */
const ORIGINAL_QUERY_PENDING = Symbol('originalQueryPending');
const ORIGINAL_QUERY_RESULT = Symbol('originalQueryResult');
const ORIGINAL_QUERY_ERROR = Symbol('originalQueryError');

/**
 * QueryableMark extended with Symbol properties for storing original handlers.
 * Used internally by wrapMarkHandlers to detect and prevent re-wrapping.
 */
type MarkWithOriginals = QueryableMark & {
  [ORIGINAL_QUERY_PENDING]?: () => unknown;
  [ORIGINAL_QUERY_RESULT]?: (data: unknown) => unknown;
  [ORIGINAL_QUERY_ERROR]?: (error: unknown) => unknown;
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

/**
 * Checks the aggregate state of all chart marks and reports errors when all marks are done.
 * This function is called after mark handlers complete to determine if the chart succeeded or failed.
 *
 * @param chart - Retained chart with mark state tracking
 * @param onError - Callback invoked with first error when marks fail
 * @param runtimeIssueReporter - Optional reporter for runtime issues
 * @param runtimeIssueContext - Context for runtime issue reporting
 * @param dataPolicy - Optional policy for validating chart data
 */
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

/**
 * Wraps chart mark handlers (queryPending, queryResult, queryError) to track state and report errors.
 * This function is idempotent - it stores original handlers in Symbols and only wraps once.
 * Subsequent calls update the closures with fresh dataPolicy/runtimeIssue reporters without nesting wrappers.
 *
 * Pre-populates all queryable marks with 'idle' state for proper aggregate state tracking.
 *
 * @param chart - Retained chart whose marks will be wrapped
 * @param onError - Callback invoked when mark errors occur
 * @param dataPolicy - Optional policy for validating chart data
 * @param runtimeIssueContext - Context for runtime issue reporting
 * @param runtimeIssueReporter - Optional reporter for runtime issues
 */
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
    const markWithOriginals = mark as MarkWithOriginals;

    // Pre-populate tracking for all queryable marks
    if (mark.queryPending || mark.queryResult || mark.queryError) {
      chart.markStates!.set(mark, 'idle');
    }

    // Wrap queryPending - store original if not already stored
    if (mark.queryPending) {
      if (!markWithOriginals[ORIGINAL_QUERY_PENDING]) {
        markWithOriginals[ORIGINAL_QUERY_PENDING] = mark.queryPending;
      }
      const originalPending = markWithOriginals[ORIGINAL_QUERY_PENDING]!;
      mark.queryPending = function (this: QueryableMark) {
        chart.markStates!.set(mark, 'pending');
        return originalPending.call(this);
      };
    }

    // Wrap queryResult - store original if not already stored
    if (mark.queryResult) {
      if (!markWithOriginals[ORIGINAL_QUERY_RESULT]) {
        markWithOriginals[ORIGINAL_QUERY_RESULT] = mark.queryResult;
      }
      const originalQueryResult = markWithOriginals[ORIGINAL_QUERY_RESULT]!;
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

    // Wrap queryError - store original if not already stored
    if (mark.queryError) {
      if (!markWithOriginals[ORIGINAL_QUERY_ERROR]) {
        markWithOriginals[ORIGINAL_QUERY_ERROR] = mark.queryError;
      }
      const originalQueryError = markWithOriginals[ORIGINAL_QUERY_ERROR]!;
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
      // Check aggregate state before clearing to preserve error state
      checkAndReportAggregateState(
        cachedChart,
        onError,
        runtimeIssueReporter,
        runtimeIssueContext,
        dataPolicy,
      );

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
