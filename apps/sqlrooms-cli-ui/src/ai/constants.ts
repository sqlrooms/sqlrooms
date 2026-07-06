import {
  BLOCK_DOCUMENT_AGENT_TOOL_NAME,
  KnownDocumentBlockTools,
} from '@sqlrooms/documents';
import {KnownMosaicBlockDocumentTools} from '@sqlrooms/mosaic/ai';

export const CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME =
  BLOCK_DOCUMENT_AGENT_TOOL_NAME;

export const KnownBlockDocumentTools = {
  ...KnownDocumentBlockTools,
  ...KnownMosaicBlockDocumentTools,
  add_html_app_block: 'add_html_app_block',
  embedded_dashboard_agent: 'embedded_dashboard_agent',
  embedded_html_app_agent: 'embedded_html_app_agent',
  create_block_document_map_block: 'create_block_document_map_block',
} as const;

export const EXPERIMENTAL_BLOCK_DOCUMENT_AGENT_INSTRUCTIONS = `Direct worksheet map blocks are available in this CLI app.
In this app, a Worksheet is a block document artifact, and direct map blocks are block-document map blocks.
For worksheet map requests, call ${KnownBlockDocumentTools.create_block_document_map_block}. Do not create a dashboard block just to hold a map.
If updating an existing worksheet map, call list_block_document_blocks first and pass its statefulBlock.blockInstanceId as mapId to ${KnownBlockDocumentTools.create_block_document_map_block}.`;
