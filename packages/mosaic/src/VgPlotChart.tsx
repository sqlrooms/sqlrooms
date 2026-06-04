import {Param, Selection} from '@uwdata/mosaic-core';
import {Spec} from '@uwdata/mosaic-spec';
import {
  FC,
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {PlotSize, ResponsivePlot} from './ResponsivePlot';
import {useVgPlotChartError} from './useVgPlotChartError';
import {
  RetainedVgPlotChart,
  useVgPlotChartRetention,
  VgPlotChartRetention,
} from './useVgPlotChartRetention';
import {useVgPlotChartRender} from './useVgPlotChartRender';
import {VgPlotChartError} from './VgPlotChartError';
import type {
  ChartDataPolicy,
  ChartRuntimeIssueContext,
  ChartRuntimeIssueReporter,
} from './chart-runtime';

type SpecProps = {
  spec: Spec;
  /**
   * Pre-defined params/selections to inject when rendering the spec.
   * Keys are param names (without $), values are Param or Selection instances.
   * This allows multiple independently-rendered specs to share the same
   * Selection objects for cross-filtering.
   */
  params?: Map<string, Param<any> | Selection>;
  /**
   * Optional retention adapter for preserving the underlying vgplot
   * instance across temporary unmount/remount cycles, such as dashboard tab
   * switches.
   */
  retention?: VgPlotChartRetention;
  dataPolicy?: ChartDataPolicy | null;
  runtimeIssueContext?: ChartRuntimeIssueContext;
  runtimeIssueReporter?: ChartRuntimeIssueReporter;
};
type PlotProps = {plot: HTMLElement | SVGSVGElement};
type VgPlotChartProps = SpecProps | PlotProps;

export function isSpecProps(props: VgPlotChartProps): props is SpecProps {
  return 'spec' in props;
}

export function isPlotProps(props: VgPlotChartProps): props is PlotProps {
  return 'plot' in props;
}

// Re-export types for external use
export type {VgPlotChartRetention} from './useVgPlotChartRetention';
export {destroyRetainedVgPlotChart} from './useVgPlotChartRetention';
export type {RetainedVgPlotChart} from './useVgPlotChartRetention';

function areEquivalentParams(
  left?: Map<string, Param<any> | Selection>,
  right?: Map<string, Param<any> | Selection>,
) {
  if (left === right) {
    return true;
  }
  if (!left || !right || left.size !== right.size) {
    return false;
  }
  for (const [key, value] of left) {
    if (right.get(key) !== value) {
      return false;
    }
  }
  return true;
}

/**
 * Renders a Vega-Lite chart using the Mosaic library.
 *
 * @param {VgPlotChartProps} props - The component props.
 * @param {Spec} props.spec - The Vega-Lite specification for the chart.
 * @returns {React.ReactElement} The rendered chart component.
 */
export const VgPlotChart: FC<VgPlotChartProps> = memo(
  (props) => {
    const [containerSize, setContainerSize] = useState<PlotSize | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const specKey = useMemo(
      () => (isSpecProps(props) ? JSON.stringify(props.spec) : null),
      [props],
    );

    const {error, setError} = useVgPlotChartError(specKey);
    const {getCachedChart, setCachedChart} = useVgPlotChartRetention(
      specKey,
      isSpecProps(props) ? props.params : undefined,
      isSpecProps(props) ? props.retention : undefined,
    );

    const handleResize = useCallback((size: PlotSize) => {
      setContainerSize((prev) => {
        if (prev && prev.width === size.width && prev.height === size.height) {
          return prev;
        }
        return size;
      });
    }, []);

    const handleError = useCallback(
      (error: Error) => {
        setError(error);
      },
      [setError],
    );

    const handleChartCreated = useCallback(
      (chart: RetainedVgPlotChart) => {
        setCachedChart(chart);
      },
      [setCachedChart],
    );

    const cachedChart = useMemo(() => getCachedChart(), [getCachedChart]);

    // Handle PlotProps: directly render the provided plot element
    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container || !isPlotProps(props)) {
        return;
      }

      if (
        container.childNodes.length !== 1 ||
        container.firstChild !== props.plot
      ) {
        container.replaceChildren(props.plot);
      }
    }, [props]);

    // Handle SpecProps: render from spec using hooks
    const renderParams = useMemo(() => {
      if (!isSpecProps(props)) {
        return {
          containerRef,
          spec: {} as Spec,
          specKey: null,
          params: undefined,
          containerSize: null,
          cachedChart: null,
          onChartCreated: handleChartCreated,
          onError: handleError,
          dataPolicy: undefined,
          runtimeIssueContext: undefined,
          runtimeIssueReporter: undefined,
        };
      }

      return {
        containerRef,
        spec: props.spec,
        specKey,
        params: props.params,
        containerSize,
        cachedChart,
        onChartCreated: handleChartCreated,
        onError: handleError,
        dataPolicy: props.dataPolicy,
        runtimeIssueContext: props.runtimeIssueContext,
        runtimeIssueReporter: props.runtimeIssueReporter,
      };
    }, [
      props,
      specKey,
      containerSize,
      cachedChart,
      handleChartCreated,
      handleError,
    ]);

    useVgPlotChartRender(renderParams);

    // Show error message if present
    if (error) {
      return <VgPlotChartError error={error} />;
    }

    return (
      <ResponsivePlot
        ref={containerRef}
        onResize={handleResize}
        className="h-full w-full"
      />
    );
  },
  (prevProps, nextProps) => {
    if (isPlotProps(prevProps) && isPlotProps(nextProps)) {
      return prevProps.plot === nextProps.plot;
    }
    if (isSpecProps(prevProps) && isSpecProps(nextProps)) {
      const specEqual =
        JSON.stringify(prevProps.spec) === JSON.stringify(nextProps.spec);
      const paramsEqual = areEquivalentParams(
        prevProps.params,
        nextProps.params,
      );
      const retentionEqual = prevProps.retention === nextProps.retention;
      const policyEqual = prevProps.dataPolicy === nextProps.dataPolicy;
      const issueReporterEqual =
        prevProps.runtimeIssueReporter === nextProps.runtimeIssueReporter;
      const issueContextEqual =
        prevProps.runtimeIssueContext === nextProps.runtimeIssueContext;
      return (
        specEqual &&
        paramsEqual &&
        retentionEqual &&
        policyEqual &&
        issueContextEqual &&
        issueReporterEqual
      );
    }
    return false;
  },
);

VgPlotChart.displayName = 'VgPlotChart';
