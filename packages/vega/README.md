A package that provides Vega-Lite visualization components for the SQLRooms framework, allowing you to create interactive data visualizations directly from SQL queries.

## About Vega-Lite

[Vega-Lite](https://vega.github.io/vega-lite/) is a high-level grammar of interactive graphics. It provides a concise, declarative JSON syntax to create an expressive range of visualizations for data analysis and presentation.

Vega-Lite specifications describe visualizations as encoding mappings from data to properties of graphical marks (e.g., points or bars). The Vega-Lite compiler automatically produces visualization components including axes, legends, and scales. This approach allows for concise specifications while giving users control to customize various parts of a visualization.

This package integrates Vega-Lite with SQLRooms, allowing you to easily create data visualizations directly from SQL queries.

## Components

### VegaLiteChart

A React component that renders a Vega-Lite chart with SQL data and responsive sizing.

#### Features

- **SQL-Powered**: Directly use SQL queries to fetch data for your visualizations
- **Responsive Design**: Multiple sizing options to fit any layout
- **Aspect Ratio Control**: Maintain visual consistency with customizable aspect ratios
- **Integration with DuckDB**: Seamlessly works with the SQLRooms DuckDB integration

#### Installation

```bash
npm install @sqlrooms/vega
# or
yarn add @sqlrooms/vega
```

#### Usage

```tsx
import {VegaLiteChart} from '@sqlrooms/vega';

// Basic usage
function MyChart() {
  return (
    <VegaLiteChart
      sqlQuery="SELECT category, count(*) as count FROM sales GROUP BY category"
      spec={{
        mark: 'bar',
        encoding: {
          x: {field: 'category', type: 'nominal'},
          y: {field: 'count', type: 'quantitative'},
        },
      }}
    />
  );
}
```

#### Props

| Prop          | Type                          | Default     | Description                                                           |
| ------------- | ----------------------------- | ----------- | --------------------------------------------------------------------- |
| `sqlQuery`    | `string`                      | (required)  | The SQL query to fetch data for the chart                             |
| `spec`        | `string \| VisualizationSpec` | (required)  | The Vega-Lite specification for the chart                             |
| `width`       | `number \| 'auto'`            | `'auto'`    | The chart width in pixels, or 'auto' to use container width           |
| `height`      | `number \| 'auto'`            | `'auto'`    | The chart height in pixels, or 'auto' to calculate from aspect ratio  |
| `aspectRatio` | `number`                      | `3/2`       | The desired width-to-height ratio when dimensions are auto-calculated |
| `className`   | `string`                      | `undefined` | Additional CSS classes to apply to the container                      |

#### Sizing Options

The chart can be sized in multiple ways:

- **Fixed dimensions**: Provide both width and height as numbers
- **Fixed width, proportional height**: Provide width as number, height as 'auto'
- **Fixed height, proportional width**: Provide height as number, width as 'auto'
- **Fully responsive**: Leave both as 'auto' (default), chart will fill container while maintaining aspect ratio

#### Examples

**Fixed size chart:**

```tsx
<VegaLiteChart
  width={600}
  height={400}
  sqlQuery="SELECT category, count(*) as count FROM sales GROUP BY category"
  spec={{
    mark: 'bar',
    encoding: {
      x: {field: 'category', type: 'nominal'},
      y: {field: 'count', type: 'quantitative'},
    },
  }}
/>
```

**Responsive chart with 16:9 aspect ratio:**

```tsx
<VegaLiteChart
  className="max-w-[600px]"
  aspectRatio={16 / 9}
  sqlQuery="SELECT date, value FROM metrics"
  spec={{
    mark: 'line',
    encoding: {
      x: {field: 'date', type: 'temporal'},
      y: {field: 'value', type: 'quantitative'},
    },
  }}
/>
```

### VegaChartTool

A tool for creating Vega-Lite charts in AI-assisted workflows, designed to work with the [SQLRooms AI assistant framework](/api/ai/).

#### Features

- **AI Integration**: Allows AI assistants to create data visualizations
- **SQL-Powered**: Uses SQL queries to fetch data for visualizations
- **Declarative Specs**: Uses Vega-Lite's declarative JSON syntax for chart creation
- **Responsive Design**: Charts automatically adapt to container size

#### Usage

```tsx
import {createVegaChartTool} from '@sqlrooms/vega';
import {createAiSlice} from '@sqlrooms/ai';
import {createRoomStore} from '@sqlrooms/room-shell';

// Create a room store with the VegaChartTool configured
export const {roomStore, useRoomStore} = createRoomStore((set, get, store) => ({
  // Other slices and state...

  // AI slice with custom tools
  ...createAiSlice({
    getApiKey: (modelProvider: string) => {
      return get()?.apiKeys[modelProvider] || '';
    },
    // Configure custom tools at store creation time
    customTools: {
      // Add the VegaChart tool
      chart: createVegaChartTool({
        // Optional custom description
        description:
          'Create data visualizations using Vega-Lite and SQL queries',
      }),

      // Other custom tools...
    },
  })(set, get, store),

  // Other state and methods...
}));
```

#### Tool Parameters

The VegaChartTool accepts the following parameters:

| Parameter      | Type     | Description                                                 |
| -------------- | -------- | ----------------------------------------------------------- |
| `sqlQuery`     | `string` | The SQL query to fetch data for the chart                   |
| `vegaLiteSpec` | `string` | The Vega-Lite specification as a JSON string                |
| `reasoning`    | `string` | Optional explanation of the chart's purpose or significance |

#### Example AI Assistant Usage

When the AI assistant uses the VegaChartTool, it will generate a response like this:

```json
{
  "sqlQuery": "SELECT product_category, SUM(sales) as total_sales FROM sales GROUP BY product_category ORDER BY total_sales DESC LIMIT 10",
  "vegaLiteSpec": "{\"mark\": \"bar\", \"encoding\": {\"x\": {\"field\": \"product_category\", \"type\": \"nominal\", \"sort\": \"-y\"}, \"y\": {\"field\": \"total_sales\", \"type\": \"quantitative\", \"title\": \"Total Sales\"}, \"color\": {\"field\": \"product_category\", \"type\": \"nominal\", \"legend\": null}}}",
  "reasoning": "This chart visualizes the top 10 product categories by total sales to identify the best-performing categories."
}
```

In a conversation with the AI assistant, it might look like this:

```
User: Can you show me a chart of our top 10 product categories by sales?

AI: I'll create a visualization of your top 10 product categories by sales.

[Chart: Bar chart showing product categories on the x-axis and total sales on the y-axis]

This chart displays your top 10 product categories ranked by total sales. As you can see,
Electronics leads with the highest sales, followed by Furniture and Clothing. This visualization
helps identify which product categories are driving the most revenue for your business.
```

The tool will:

1. Execute the SQL query to fetch the data
2. Apply the Vega-Lite specification to create the visualization
3. Render the chart in the UI with responsive sizing

## Dependencies

This package depends on:

- `@sqlrooms/duckdb` - For SQL query execution
- `@sqlrooms/ui` - For UI utilities
- `@sqlrooms/utils` - For utility functions
- `@sqlrooms/ai` - For AI assistant integration
- `react-vega` - For rendering Vega-Lite visualizations
