# @sqlrooms/vega

Vega-Lite chart components and AI chart tool integration for SQLRooms.

## Installation

```bash
npm install @sqlrooms/vega @sqlrooms/duckdb @sqlrooms/ui
```

## Main exports

- `VegaLiteChart` (simple + compound component API)
- `createVegaChartTool()` for AI tool workflows
- `VegaChartToolResult`
- editor utilities/hooks (`useVegaChartEditor`, `useVegaEditorContext`)

## Quick start (simple chart)

```tsx
import {VegaLiteChart} from '@sqlrooms/vega';

export function SalesChart() {
  return (
    <VegaLiteChart
      sqlQuery="SELECT category, SUM(amount) AS total FROM sales GROUP BY category"
      spec={{
        mark: 'bar',
        encoding: {
          x: {field: 'category', type: 'nominal'},
          y: {field: 'total', type: 'quantitative'},
        },
      }}
      aspectRatio={16 / 9}
    />
  );
}
```

## Compound component API (editable chart workflow)

```tsx
import {VegaLiteChart, type VisualizationSpec} from '@sqlrooms/vega';

const initialSpec: VisualizationSpec = {
  mark: 'line',
  encoding: {
    x: {field: 'date', type: 'temporal'},
    y: {field: 'value', type: 'quantitative'},
  },
};

<VegaLiteChart.Container
  spec={initialSpec}
  sqlQuery="SELECT date, value FROM metrics"
  editable
  onSpecChange={(spec) => console.log('next spec', spec)}
  onSqlChange={(sql) => console.log('next sql', sql)}
>
  <VegaLiteChart.Actions />
  <VegaLiteChart.Chart />
  <VegaLiteChart.SpecEditor />
  <VegaLiteChart.SqlEditor />
</VegaLiteChart.Container>;
```

## AI integration (`createVegaChartTool`)

```tsx
import {
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiTools,
} from '@sqlrooms/ai';
import {createVegaChartTool} from '@sqlrooms/vega';

// inside your createRoomStore composer
createAiSlice({
  tools: {
    ...createDefaultAiTools(store),
    chart: createVegaChartTool({
      editable: true,
      editorMode: 'both',
    }),
  },
  getInstructions: () => createDefaultAiInstructions(store),
})(set, get, store);
```

`createVegaChartTool` parameters:

- `sqlQuery`: SQL used to fetch chart data
- `vegaLiteSpec`: Vega-Lite JSON string
- `reasoning`: chart rationale shown to users

## Example apps

- Vega example: https://github.com/sqlrooms/examples/tree/main/vega
- AI example (with chart tool): https://github.com/sqlrooms/examples/tree/main/ai
