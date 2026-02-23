# @sqlrooms/recharts

Recharts integration for SQLRooms with a theme-aware chart container and tooltip/legend helpers.

This package re-exports the full `recharts` API and adds SQLRooms-friendly wrappers:

- `ChartContainer`
- `ChartTooltip`, `ChartTooltipContent`
- `ChartLegend`, `ChartLegendContent`
- `ChartConfig` typing for series labels/colors

## Installation

```bash
npm install @sqlrooms/recharts
```

## Basic usage

```tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  YAxis,
} from '@sqlrooms/recharts';

const defaultRows = [
  {month: 'Jan', revenue: 1200},
  {month: 'Feb', revenue: 1800},
  {month: 'Mar', revenue: 1600},
];

export function RevenueChart({
  rows = defaultRows,
}: {
  rows?: Array<{month: string; revenue: number}>;
}) {
  return (
    <ChartContainer
      className="h-64 w-full"
      config={{
        revenue: {
          label: 'Revenue',
          color: 'hsl(var(--chart-1))',
        },
      }}
    >
      <BarChart data={rows}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}
```

## Using with SQLRooms query results

```tsx
import {useSql} from '@sqlrooms/duckdb';

function RevenueChartFromSql() {
  const {data} = useSql<{month: string; revenue: number}>({
    query: `
      SELECT month, SUM(revenue) AS revenue
      FROM sales
      GROUP BY month
      ORDER BY month
    `,
  });

  const rows = data?.toArray() ?? [];
  return <RevenueChart rows={rows} />;
}
```

## Notes

- `@sqlrooms/recharts` is UI-only; it does not require a specific SQLRooms slice.
- Best used with `@sqlrooms/duckdb` query hooks and `@sqlrooms/ui` theming.
