/**
 * Read-only skill root for dashboard guidance owned by `@sqlrooms/mosaic`.
 */
export const MOSAIC_DASHBOARD_SKILL_ROOT = {
  id: 'package:@sqlrooms/mosaic',
  label: '@sqlrooms/mosaic dashboard skills',
  writable: false,
} as const;

/**
 * Package-owned dashboard skills. These describe reusable Mosaic dashboard
 * judgment without SQLRooms CLI artifact policy.
 */
export const MOSAIC_DASHBOARD_SKILLS = [
  {
    id: 'chart-selection',
    manifest: {
      id: 'chart-selection',
      version: '0.1.0',
      name: 'Chart Selection',
      description:
        'Choose Mosaic chart and panel types from analytical intent and data shape.',
    },
    instructions: `
Use this skill when deciding which dashboard panel best matches a question.

- Prefer histograms for one numeric distribution.
- Prefer count plots for categorical frequency or ranking when the category count is modest.
- Prefer line charts for ordered time or sequence trends; aggregate before plotting large tables.
- Prefer scatter plots for relationships between two numeric measures only when row count is manageable.
- Prefer heatmaps for dense relationships, binned numeric comparisons, or high-row-count scatter alternatives.
- Prefer box plots for comparing numeric distributions across groups.
- Prefer data table explorer panels when users need raw records, column summaries, or sortable detail.
- Prefer map panels only when the host provides a map tool and the data has spatial fields.

Do not use this skill to invent unsupported panel types. If the runtime lacks the needed panel, choose the closest supported chart or explain the limitation.
`.trim(),
  },
  {
    id: 'dashboard-design-principles',
    manifest: {
      id: 'dashboard-design-principles',
      version: '0.1.0',
      name: 'Dashboard Design Principles',
      description:
        'Design coherent Mosaic dashboards with useful density, grouping, labels, and filters.',
    },
    instructions: `
Use this skill when arranging multiple Mosaic panels into a dashboard.

- Build a coherent analytical path: overview first, then breakdowns, then detail.
- Keep exploratory dashboards to 3-5 strong panels before adding refinements.
- Use short, specific panel titles that name the measure and grouping.
- Avoid chart soup: each panel should answer a different question.
- Put related panels near each other and avoid duplicating the same encoding repeatedly.
- Prefer durable dashboard state changes through commands or tools; skills provide guidance only.
- When a dashboard already exists, inspect panels before updating so edits target the intended panel.

Do not use this skill to override tool schemas, command contracts, or selected-table runtime behavior.
`.trim(),
  },
  {
    id: 'exploratory-dashboard',
    manifest: {
      id: 'exploratory-dashboard',
      version: '0.1.0',
      name: 'Exploratory Dashboard',
      description:
        'Create a compact set of coordinated views that reveal dataset structure.',
    },
    instructions: `
Use this skill when the user asks to explore, understand, profile, or get a high-level view of a dataset.

- Start with broad shape: row count, important ranges, common categories, and missing-looking dimensions.
- Create 3-5 panels that cover complementary aspects: distribution, trend, relationship, segment, and detail.
- Use aggregated charts for large tables before considering row-level encodings.
- Include a data table explorer panel when field summaries or raw-detail inspection would help the user continue.
- Stop once the dashboard has a useful first pass; follow-up edits can refine the layout.

Do not spend the whole run querying without creating panels.
`.trim(),
  },
  {
    id: 'kpi-dashboard',
    manifest: {
      id: 'kpi-dashboard',
      version: '0.1.0',
      name: 'KPI Dashboard',
      description:
        'Build metrics-first dashboards with headline measures, trends, breakdowns, and guardrails.',
    },
    instructions: `
Use this skill when the user asks for KPI, metric, performance, scorecard, revenue, growth, retention, or operational tracking.

- Identify the headline metric, its time grain, and the most useful denominators or guardrails.
- Show a trend before detailed segmentation when time fields exist.
- Add one or two breakdowns that explain movement by segment, category, region, channel, or product.
- Use clear aggregation in titles, such as "Monthly Revenue" or "Orders by Region".
- Include a detail or table panel only when it helps audit the metric.

Do not present raw counts as KPIs when a rate, denominator, or time window is required but unavailable.
`.trim(),
  },
  {
    id: 'diagnostic-dashboard',
    manifest: {
      id: 'diagnostic-dashboard',
      version: '0.1.0',
      name: 'Diagnostic Dashboard',
      description:
        'Compare periods, segment drivers, decompose changes, and surface anomalies or detail records.',
    },
    instructions: `
Use this skill when the user asks why a metric changed, what drove an anomaly, or how two periods or segments differ.

- Establish the comparison frame first: period, cohort, segment, or baseline.
- Create panels that isolate drivers: trend, segment contribution, distribution shift, and outlier/detail.
- Prefer grouped or faceted views when comparing a small number of categories.
- Use queries to confirm candidate drivers before creating durable panels.
- Surface uncertainty when the available fields do not support causal interpretation.

Do not claim root cause from correlation alone.
`.trim(),
  },
  {
    id: 'mosaic-dashboard-runtime',
    manifest: {
      id: 'mosaic-dashboard-runtime',
      version: '0.1.0',
      name: 'Mosaic Dashboard Runtime',
      description:
        'Respect Mosaic dashboard constraints, selected-table behavior, filters, panel limits, and query cost.',
    },
    instructions: `
Use this skill whenever creating or editing a Mosaic dashboard.

- A dashboard has a selected table; use the provided tableName or the dashboard selected table.
- Inspect existing panels before modifying, replacing, or adding related panels.
- Keep durable mutations in tools and commands. Skills never grant tools and never mutate state directly.
- Respect panel validation errors and runtime issues; adjust chart type, fields, or aggregation when needed.
- Limit expensive exploration. Prefer summaries, grouping, and limits before high-cardinality row-level views.
- Use host-provided map tools only when present; otherwise choose a supported non-map panel or explain the limitation.

Do not rely on hidden state or app-specific artifact rules from a reusable package skill.
`.trim(),
  },
] as const;

const KPI_TERMS =
  /\b(kpi|metric|scorecard|revenue|sales|growth|retention|churn|conversion|performance)\b/i;
const DIAGNOSTIC_TERMS =
  /\b(why|changed|change|driver|diagnos|anomal|compare|period|difference|decompos|explain)\b/i;
const EXPLORATORY_TERMS =
  /\b(explore|exploratory|overview|understand|profile|summar|insight|comprehensive|high-level)\b/i;

/**
 * Select a compact package-owned skill set for a dashboard request.
 */
export function selectMosaicDashboardSkillIds(
  intent: string,
): ReadonlyArray<string> {
  const ids = new Set<string>([
    'chart-selection',
    'dashboard-design-principles',
    'mosaic-dashboard-runtime',
  ]);

  if (KPI_TERMS.test(intent)) ids.add('kpi-dashboard');
  if (DIAGNOSTIC_TERMS.test(intent)) ids.add('diagnostic-dashboard');
  if (EXPLORATORY_TERMS.test(intent) || ids.size === 3) {
    ids.add('exploratory-dashboard');
  }

  return [...ids];
}
