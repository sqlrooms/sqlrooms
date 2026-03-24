import {getErrorMessage} from './utils';

export const DEFAULT_DASHBOARD_VGPLOT_SPEC = JSON.stringify(
  {
    $schema: 'https://idl.uw.edu/mosaic/schema/latest.json',
    meta: {
      title: 'New Dashboard',
      description:
        'Use the assistant to generate a dashboard spec from your current DuckDB tables.',
    },
    data: {
      sample: {
        type: 'table',
        query: `
          SELECT * FROM (
            VALUES
              ('A', 12),
              ('B', 26),
              ('C', 18),
              ('D', 9)
          ) AS t(category, amount)
        `,
      },
    },
    plot: [
      {
        mark: 'barY',
        data: {from: 'sample'},
        x: 'category',
        y: 'amount',
        fill: 'category',
      },
    ],
    xLabel: 'Category',
    yLabel: 'Amount',
    width: 560,
    height: 320,
  },
  null,
  2,
);

export function parseVgPlotSpecString(vgplot: string): {
  parsed: Record<string, unknown>;
  formatted: string;
} {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(vgplot);
  } catch (error) {
    throw new Error(
      `VgPlot spec must be valid JSON. ${getErrorMessage(error)}`,
    );
  }
  if (
    typeof parsedValue !== 'object' ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error('VgPlot spec must be a JSON object.');
  }
  return {
    parsed: parsedValue as Record<string, unknown>,
    formatted: JSON.stringify(parsedValue, null, 2),
  };
}

export function toVgPlotSpecString(
  vgplot: string | Record<string, unknown>,
): string {
  return typeof vgplot === 'string' ? vgplot : JSON.stringify(vgplot, null, 2);
}
