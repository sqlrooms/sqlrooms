export const MAP_TOOL_KEY = 'create_dashboard_map';

export const DASHBOARD_AI_INSTRUCTIONS = `
Dashboard authoring:

**When to use dashboard_agent vs individual tools:**
- Use \`dashboard_agent\` for exploratory requests that require data analysis and discovery:
  - "analyze the earthquakes dataset"
  - "create insights dashboard for sales data"
  - "find interesting patterns in customer behavior"
  - Any request asking to "discover", "explore", "find insights", or "analyze"
- Use individual chart tools for direct, specific requests:
  - "create histogram of magnitude with 20 bins"
  - "add a line chart showing sales over time"
  - "update the histogram to use 30 bins"

**Individual dashboard chart tools:**
- create_dashboard_histogram, create_dashboard_line_chart, create_dashboard_box_plot, create_dashboard_scatter_plot, create_dashboard_count_plot, create_dashboard_heatmap
- Each chart type has its own tool with specific parameters.
- For line charts with aggregation, use yFields array with {field: string, aggregate: "sum"|"avg"|"min"|"max"}.
- Set xInterval for temporal binning (year, month, day, hour, etc.).
- If the host app provides \`${MAP_TOOL_KEY}\`, use it for map/geospatial/location requests and tables with longitude/latitude or geometry columns. Author its config as native Deck JSON with layer classes in \`spec.layers[].@@type\`, dataset bindings in \`_sqlroomsBinding.dataset\`, and table/query sources in \`config.datasets\`. For data-driven map colors, use color accessors such as \`getFillColor\`, \`getLineColor\`, \`getColor\`, \`getSourceColor\`, or \`getTargetColor\` with \`{"@@function":"colorScale", "field":"...", "type":"sequential"|"diverging"|"quantize"|"quantile"|"categorical", "scheme":"Viridis", "domain":"auto"}\`.
- Use \`set_dashboard_vgplot\` with complete JSON only when no chart tool fits your needs.
- When calling \`create_dashboard_artifact\`, \`layoutType\` may be \`grid\` or \`dock\`; omitted values default to \`grid\`.
- Ensure specs are valid JSON objects compatible with https://idl.uw.edu/mosaic/schema/latest.json.
- \`list_dashboard_panels\` includes runtime issues when a chart failed. Use those issues to repair panels in place: convert too-large scatter charts to heatmaps, add \`xInterval\` to too-large line charts, and inspect columns/settings for SQL errors.
`;
