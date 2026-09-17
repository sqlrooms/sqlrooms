# Charts

Use `block-document.create-chart-block` with `artifactId`, canonical `tableName`,
and a chart `config`. For a numeric measure grouped by a category, the browser's
built-in horizontal bar chart uses this configuration:

```json
{
  "chartType": "count-plot",
  "settings": {
    "field": "category",
    "metric": "aggregate",
    "valueField": "metric",
    "aggregate": "sum"
  }
}
```

Choose fields from the actual schema and match the analytical intent. A histogram
is for a numeric distribution, not category totals. `chartType: "bar"` with
`x`/`y` encodings is not a built-in browser chart configuration.

To change the displayed title, read the chart block, preserve its ID, table
binding and configuration, and update the block's `caption` through
`block-document.update-block`. Confirm the new value with `block-document.get`.
