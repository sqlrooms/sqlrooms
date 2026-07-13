# Chart

Create Vega-Lite chart visualizations from SQL query results.

## When to Use

When the user asks for a chart, plot, graph, histogram, or any non-map data
visualization. Do NOT use this skill for geographic/map visualizations — use
`map-visualization` instead.

## Workflow

1. Verify the data exists by running a `data.query` check (or use an existing
   table).
2. Build the Vega-Lite spec and the SQL query that provides its data.
3. Call `executeApi` with `apiName: "createChart"` to validate and render the chart.

```json
{
  "call": {
    "apiName": "createChart",
    "args": {
      "sqlQuery": "SELECT category, COUNT(*) AS cnt FROM my_table GROUP BY category",
      "vegaLiteSpec": "{\"mark\":\"bar\",\"encoding\":{\"x\":{\"field\":\"category\",\"type\":\"nominal\"},\"y\":{\"field\":\"cnt\",\"type\":\"quantitative\"}},\"width\":\"container\"}",
      "reasoning": "Bar chart of category counts"
    }
  },
  "reasoning": "User asked for a category breakdown chart."
}
```

## Rules

- Use Vega-Lite syntax.
- Each `createChart` call creates ONE chart — do NOT use faceting (`column`,
  `row`, or `facet` encodings), fold transforms, `hconcat`, `vconcat`,
  `concat`, `layer` with independent axis resolves, or dual-axis patterns that
  create multiple sub-plots within a single chart. Call `createChart` multiple
  times to produce multiple charts.
- Choose appropriate chart types based on the data and analysis goals.
- Use clear titles and axis labels.
- Consider color schemes for better readability.
- Add meaningful tooltips when relevant.
- Format numbers and dates appropriately.
- Use aggregations when dealing with large datasets (more than 100,000 rows) —
  e.g. no scatter plot for large datasets.
- Do NOT use the chart skill to create a map; use `map-visualization` instead.
- ALWAYS verify the SQL query returns expected data before charting. If the
  query fails or returns an empty result, fix the SQL first.
- When x-axis categories are ordinal bins stored as strings (e.g. income bins
  like "Under $50k", "$50k - $100k", "$100k+"), avoid lexicographic ordering by
  explicitly specifying a numeric sort:
  - Prefer adding a numeric sort key (e.g. "range_start") via a transform
    calculate that extracts the lower bound, then set `encoding.x.sort` to
    `{ "field": "range_start", "order": "ascending" }`.
  - Alternatively, provide an explicit sort array for `encoding.x.sort` when
    the category list is small and known.
- Bar/area marks are drawn from a zero baseline. For a wide value range, set
  the positional scale to `"type": "symlog"` — NEVER `"type": "log"` on a bar
  or area chart, because `log(0)` is undefined and the bars render empty.
  FALSIFIABLE CHECK: if `mark` is `bar`/`area` and any `encoding.x`/`encoding.y`
  has `scale.type: "log"`, you erred — use `symlog`. (Line/point/scatter marks
  may still use `"log"`.)
- Omit the `data` field from the Vega-Lite spec — the `sqlQuery` argument
  supplies data at render time.
- Set the top-level `width` property to `"container"` so the chart stretches to
  the full width of its parent.
- For bar charts with few categories (<= 5), widen bars by reducing band
  padding on the x scale:
  - 2–3 categories: set `encoding.x.scale.paddingInner` to 0.2 and
    `paddingOuter` to 0.1.
  - 4–5 categories: set `encoding.x.scale.paddingInner` to 0.1 and
    `paddingOuter` to 0.05.
- If the chart uses an encoding channel like color, shape, or size to represent
  a data field, include a legend object in that channel's encoding.

## Chart Type Selection

| Data Pattern        | Chart Type                                             |
| ------------------- | ------------------------------------------------------ |
| Trend over time     | Line chart                                             |
| Category comparison | Bar chart                                              |
| Part-of-whole       | Pie/arc chart (only when share/proportion data exists) |
| Distribution        | Histogram or box plot                                  |
| Correlation         | Scatter plot (avoid for >100K rows)                    |
| Geographic          | Use map visualization skill instead                    |

## Cross-references

- Load `map-visualization` when results have spatial dimensions and should be
  shown on a map rather than a chart.
