export const WORKSHEET_CHART_TOOL_PREFIX = 'create_worksheet_block_';

/**
 * Known worksheet AI tool names.
 * These are the core tools available to worksheet agents.
 */
export const KnownWorksheetTools = {
  list_blocks: 'list_worksheet_blocks',
  add_text_block: 'add_text_block',
  add_dashboard_block: 'add_dashboard_block',
  add_html_app_block: 'add_html_app_block',
  add_data_table_explorer: 'add_data_table_explorer',
  embedded_dashboard_agent: 'embedded_dashboard_agent',
  embedded_html_app_agent: 'embedded_html_app_agent',
} as const;
