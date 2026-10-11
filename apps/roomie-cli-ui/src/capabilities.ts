/** Fixed product manifest used by schemas, commands and insertion menus. */
export const ROOMIE_CAPABILITIES = {
  application: 'roomie',
  schemaVersion: 1,
  artifacts: ['block-document'],
  blocks: ['chart', 'data-table', 'dashboard', 'html-app'],
  chartTypes: [
    'histogram',
    'count-plot',
    'line-chart',
    'heatmap',
    'box-plot',
    'scatter-plot',
  ],
  dashboardPanels: ['vgplot', 'data-table-explorer'],
} as const;
export const STATEFUL_BLOCKS = ['data-table', 'dashboard', 'html-app'] as const;
export const EDITORIAL_BLOCKS = [
  'paragraph',
  'heading',
  'list',
  'todo',
  'image',
  'chartImage',
] as const;
