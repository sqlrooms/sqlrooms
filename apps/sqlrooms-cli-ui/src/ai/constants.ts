import {KnownDocumentBlockTools} from '@sqlrooms/documents';
import {KnownMosaicBlockDocumentTools} from '@sqlrooms/mosaic/ai';

export const WORKSHEET_AGENT_TOOL_NAME = 'worksheet_agent';

export const KnownWorksheetTools = {
  ...KnownDocumentBlockTools,
  ...KnownMosaicBlockDocumentTools,
  add_html_app_block: 'add_html_app_block',
  embedded_dashboard_agent: 'embedded_dashboard_agent',
  embedded_html_app_agent: 'embedded_html_app_agent',
  create_worksheet_map_block: 'create_worksheet_map_block',
} as const;

export const EXPERIMENTAL_WORKSHEET_AGENT_INSTRUCTIONS = `Direct worksheet map blocks are available in this CLI app.
For worksheet map requests, call ${KnownWorksheetTools.create_worksheet_map_block}. Do not create a dashboard block just to hold a map.
If updating an existing worksheet map, call list_block_document_blocks first and pass its statefulBlock.blockInstanceId as mapId to ${KnownWorksheetTools.create_worksheet_map_block}.`;
