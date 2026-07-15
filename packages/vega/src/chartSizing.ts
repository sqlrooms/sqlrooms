import type * as arrow from 'apache-arrow';
import type {VisualizationSpec} from 'vega-embed';

/** Height behavior for a Vega chart result. */
export type VegaChartHeight = number | 'auto';

/** Data available when resolving the height of a rendered Vega chart. */
export interface VegaChartSizingContext {
  /** The parsed, responsive Vega-Lite specification. */
  spec: VisualizationSpec;
  /** The data loaded for the chart, when available. */
  arrowTable: arrow.Table | undefined;
}

/** Resolves a chart height from its parsed specification and loaded data. */
export type VegaChartHeightResolver = (
  context: VegaChartSizingContext,
) => VegaChartHeight;

const MIN_CATEGORY_COUNT = 12;
const MIN_AUTO_HEIGHT = 280;
const MAX_AUTO_HEIGHT = 800;
const CHART_VERTICAL_PADDING = 48;
const CATEGORY_ROW_HEIGHT = 22;
const MAX_MEANINGFUL_CATEGORY_COUNT = Math.ceil(
  (MAX_AUTO_HEIGHT - CHART_VERTICAL_PADDING) / CATEGORY_ROW_HEIGHT,
);

type JsonObject = Record<string, unknown>;

/** Returns a JSON object value while excluding arrays and primitives. */
function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

/** Extracts the Vega-Lite mark type from string and object mark definitions. */
function getMarkType(spec: JsonObject): string | undefined {
  if (typeof spec.mark === 'string') {
    return spec.mark;
  }
  return asObject(spec.mark)?.type as string | undefined;
}

/** Finds the discrete y field of a horizontal bar unit in a nested spec. */
function getHorizontalBarCategoryField(
  spec: JsonObject,
  inheritedEncoding: JsonObject = {},
): string | undefined {
  const encoding = {...inheritedEncoding, ...asObject(spec.encoding)};
  const x = asObject(encoding.x);
  const y = asObject(encoding.y);

  if (
    getMarkType(spec) === 'bar' &&
    x?.type === 'quantitative' &&
    (y?.type === 'nominal' || y?.type === 'ordinal') &&
    typeof y.field === 'string'
  ) {
    return y.field;
  }

  for (const key of ['layer', 'concat', 'hconcat', 'vconcat'] as const) {
    const children = spec[key];
    if (!Array.isArray(children)) continue;
    for (const child of children) {
      const field = getHorizontalBarCategoryField(
        asObject(child) ?? {},
        encoding,
      );
      if (field) return field;
    }
  }

  const nestedSpec = asObject(spec.spec);
  return nestedSpec
    ? getHorizontalBarCategoryField(nestedSpec, encoding)
    : undefined;
}

/** Counts distinct non-null field values up to the height saturation point. */
function countDistinctValues(table: arrow.Table, field: string): number {
  const vector = table.getChild(field);
  if (!vector) return 0;

  const values = new Set<string>();
  for (let index = 0; index < table.numRows; index += 1) {
    const value = vector.get(index);
    if (value !== null && value !== undefined) {
      values.add(`${typeof value}:${String(value)}`);
      if (values.size >= MAX_MEANINGFUL_CATEGORY_COUNT) break;
    }
  }
  return values.size;
}

/**
 * Computes a taller height for category-dense horizontal bar charts.
 *
 * Returns `'auto'` for other chart shapes so they retain aspect-ratio sizing.
 */
export function getCategoryAwareVegaChartHeight({
  spec,
  arrowTable,
}: VegaChartSizingContext): VegaChartHeight {
  if (!arrowTable) return 'auto';

  const categoryField = getHorizontalBarCategoryField(asObject(spec) ?? {});
  if (!categoryField) return 'auto';

  const categoryCount = countDistinctValues(arrowTable, categoryField);
  if (categoryCount < MIN_CATEGORY_COUNT) return 'auto';

  return Math.min(
    MAX_AUTO_HEIGHT,
    Math.max(
      MIN_AUTO_HEIGHT,
      CHART_VERTICAL_PADDING + categoryCount * CATEGORY_ROW_HEIGHT,
    ),
  );
}
