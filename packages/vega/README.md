Vega-Lite chart components and AI chart tool integration for SQLRooms.

## Installation

```bash
npm install @sqlrooms/vega @sqlrooms/duckdb @sqlrooms/ui
```

## Main exports

- `VegaLiteChart` (simple + compound component API)
- `createVegaChartTool()` for AI tool workflows
- `createChartImageForMarkdownTool()` for AI-generated Markdown document image assets
- `VegaChartToolResult`
- `InteractiveVegaChartToolResult` / `createInteractiveVegaChartToolResult` (opt-in WYSIWYG-editable chart tool renderer)
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

export function CompoundVegaChart() {
  return (
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
    </VegaLiteChart.Container>
  );
}
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

`createVegaChartTool` constructor options:

- `editable`: whether users can edit SQL/spec in the chart UI
- `editorMode`: which editors to render (`'none' | 'sql' | 'vega' | 'both'`)

### LLM invocation / Zod schema fields

At runtime, the tool call payload is validated by a Zod schema.  
These fields are supplied by the LLM when invoking the tool (not passed into
`createVegaChartTool(...)`):

- `sqlQuery`: SQL used to fetch chart data
- `vegaLiteSpec`: Vega-Lite JSON string
- `reasoning`: explanation shown to users for why this chart/spec was chosen

## Interactive chart tool renderer

`VegaChartToolResult` renders an AI-generated chart with read-only spec/SQL
editors. `InteractiveVegaChartToolResult` is an **optional, opt-in** drop-in
replacement that also enables WYSIWYG editing directly on the rendered chart:

- **Edit title** — double-click the title to rename it
- **Drag labels** — reposition data labels
- **Delete labels** — remove individual data labels

Edits update a local copy of the spec for immediate feedback and are
debounced-persisted back into the current AI session's `uiMessages` (via the
public `getCurrentSession` / `setSessionUiMessages` AI slice API), so they
survive reloads and re-renders.

```tsx
import {
  createAiSlice,
  createDefaultAiTools,
  createDefaultAiToolRenderers,
} from '@sqlrooms/ai';
import {createVegaChartTool, InteractiveVegaChartToolResult} from '@sqlrooms/vega';

createAiSlice({
  toolRenderers: {
    ...createDefaultAiToolRenderers(),
    // Opt in to interactive editing (otherwise keep VegaChartToolResult):
    chart: InteractiveVegaChartToolResult,
  },
  tools: {
    ...createDefaultAiTools(store),
    chart: createVegaChartTool(),
  },
})(set, get, store);
```

To configure defaults once, use the factory:

```tsx
import {createInteractiveVegaChartToolResult} from '@sqlrooms/vega';

createAiSlice({
  toolRenderers: {
    ...createDefaultAiToolRenderers(),
    chart: createInteractiveVegaChartToolResult({
      editorMode: 'spec',
      persistDebounceMs: 750,
    }),
  },
});
```

Props (extends `ToolRendererProps`):

- `editorMode`: which editors to show in the spec/SQL popover (`'none' | 'sql' | 'spec' | 'both'`, default `'both'`)
- `persistDebounceMs`: debounce before persisting edits to the session (default `500`)
- `options`: Vega embed options
- `className`: container class name

## Markdown document image assets

`createChartImageForMarkdownTool(store)` creates an AI-only companion tool that
renders a Vega chart to SVG or PNG, stores it as an asset on a
`@sqlrooms/documents` Markdown artifact, and returns a ready-to-insert Markdown
image link such as:

```md
![Revenue by week](asset://chart-revenue-week)
```

Use this alongside the existing document commands when the assistant needs a
portable conversation summary with static chart images instead of live SQL-backed
charts.

Chart images default to the light Vega theme with an explicit background so
exported Markdown renders predictably in GitHub, Obsidian, PDF exports, and
other document surfaces. When the requested static theme matches the current app
theme, the background is resolved from the app's Tailwind `--background` token
and written into the SVG/PNG as a concrete color. The tool also accepts
`renderTheme: "dark"` and `background` for explicit dark/static export requests.

## Example apps

- Vega example: https://github.com/sqlrooms/examples/tree/main/vega
- AI example (with chart tool): https://github.com/sqlrooms/examples/tree/main/ai
