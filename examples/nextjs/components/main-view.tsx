'use client';

import {useProjectStore} from '@/app/store';
import {useSql} from '@sqlrooms/duckdb';
import {TableCard} from '@sqlrooms/project-builder';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  type ChartConfig,
} from '@sqlrooms/recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  SpinnerPane,
} from '@sqlrooms/ui';

export function MainView() {
  const table = useProjectStore((state) =>
    state.db.findTableByName('earthquakes'),
  );
  const result = useSql<{year: string; magnitude: number; depth: number}>({
    query: `
      SELECT 
        strftime(DateTime, '%Y') AS year, 
        max(Magnitude) AS magnitude, 
        mean(Depth) AS depth 
      FROM earthquakes 
      GROUP BY Year ORDER BY Year`,
    enabled: Boolean(table),
  });

  if (!table) {
    return null;
  }

  const chartData = result.data?.toArray();
  const chartConfig = {
    magnitude: {label: 'Magnitude', color: 'var(--chart-1)'},
    depth: {label: 'Depth', color: 'var(--chart-2)'},
  } satisfies ChartConfig;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex gap-4">
        <TableCard value={table} className="p-2" isReadOnly />

        {result.isLoading ? (
          <SpinnerPane className="h-full w-full" />
        ) : result.error ? (
          <div>Error: {result.error.message}</div>
        ) : (
          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle>Earthquakes</CardTitle>
              <CardDescription>
                Showing max earthquake magnitude and depth by year
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{left: 12, right: 12}}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="year"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="magnitude"
                    type="natural"
                    fillOpacity={0.4}
                    fill="var(--color-magnitude)"
                    stroke="var(--color-magnitude)"
                    stackId="a"
                  />
                  <Area
                    dataKey="depth"
                    type="natural"
                    fillOpacity={0.4}
                    fill="var(--color-depth)"
                    stroke="var(--color-depth)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
            <CardFooter>
              <div className="flex w-full items-start gap-2 text-sm">
                <div className="grid gap-2"></div>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
