# Charts

Use `block-document.create-chart-block` with `artifactId`, canonical `tableName`,
and a chart `config`. For a numeric measure grouped by a category, a bar config
can use `chartType: "bar"`, `x: {field: "category"}` and
`y: {field: "metric", aggregate: "sum"}`. Choose fields from the real schema and
match the requested analytical intent; do not use a histogram for category totals.

To change a title, read the chart block, preserve its table binding and encodings,
and update `config.title` through `block-document.update-block`. Preserve the block
ID. Confirm the new value with `block-document.get`.
