import {Param, Selection} from '@uwdata/mosaic-core';
import {astToDOM, parseSpec, Spec} from '@uwdata/mosaic-spec';
import {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {PlotSize, ResponsivePlot} from './ResponsivePlot';

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
};
type PlotProps = {plot: HTMLElement | SVGSVGElement};
type VgPlotChartProps = SpecProps | PlotProps;
type PlotDomElement = HTMLElement | SVGSVGElement;

export type RetainedVgPlotChart = {
  element: object;
  params?: Map<string, Param<any> | Selection>;
  specKey: string;
};

export type VgPlotChartRetention = {
  chart?: RetainedVgPlotChart;
  setChart: (chart: RetainedVgPlotChart) => void;
};

type PlotInstance = {
  marks?: Array<{destroy?: () => void}>;
  render?: () => Promise<unknown> | unknown;
  setAttribute?: (name: string, value: unknown) => boolean;
};

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

export function isSpecProps(props: VgPlotChartProps): props is SpecProps {
  return 'spec' in props;
}

export function isPlotProps(props: VgPlotChartProps): props is PlotProps {
  return 'plot' in props;
}

export function destroyRetainedVgPlotChart(chart: RetainedVgPlotChart) {
  const plot = getPlotInstance(chart.element);
  plot?.marks?.forEach((mark) => {
    mark.destroy?.();
  });
}

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
    const localSpecChartRef = useRef<RetainedVgPlotChart | null>(null);
    const renderVersionRef = useRef(0);
    const specKey = useMemo(
      () => (isSpecProps(props) ? JSON.stringify(props.spec) : null),
      [props],
    );

    const handleResize = useCallback((size: PlotSize) => {
      setContainerSize((prev) => {
        if (prev && prev.width === size.width && prev.height === size.height) {
          return prev;
        }
        return size;
      });
    }, []);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !containerSize) {
        return;
      }

      if (isPlotProps(props)) {
        container.replaceChildren(props.plot);
        return;
      }

      const cached = props.retention?.chart;
      const current =
        localSpecChartRef.current &&
        localSpecChartRef.current.specKey === specKey &&
        areEquivalentParams(localSpecChartRef.current.params, props.params)
          ? localSpecChartRef.current
          : cached &&
              cached.specKey === specKey &&
              areEquivalentParams(cached.params, props.params)
            ? cached
            : null;

      if (current) {
        localSpecChartRef.current = current;
        container.replaceChildren(asPlotDomElement(current.element));
        resizeChartElement(current.element, containerSize);
        return;
      }

      const renderVersion = ++renderVersionRef.current;
      let cancelled = false;

      void createSpecChartElement(props.spec, containerSize, props.params).then(
        (element) => {
          if (
            cancelled ||
            renderVersion !== renderVersionRef.current ||
            !containerRef.current
          ) {
            return;
          }

          const nextChart = {
            element,
            params: props.params,
            specKey: specKey ?? JSON.stringify(props.spec),
          } satisfies RetainedVgPlotChart;

          localSpecChartRef.current = nextChart;
          props.retention?.setChart(nextChart);
          containerRef.current.replaceChildren(element);
        },
      );

      return () => {
        cancelled = true;
      };
    }, [containerSize, props, specKey]);

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
      return specEqual && paramsEqual && retentionEqual;
    }
    return false;
  },
);

VgPlotChart.displayName = 'VgPlotChart';
