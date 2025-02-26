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

## Dependencies

This package depends on:

- `@sqlrooms/duckdb` - For SQL query execution
- `@sqlrooms/ui` - For UI utilities
- `@sqlrooms/utils` - For utility functions
- `react-vega` - For rendering Vega-Lite visualizations
