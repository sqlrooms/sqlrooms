import {createDefaultAiInstructions} from '@sqlrooms/ai';
import type {StoreApi} from 'zustand';
import {CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME} from './ai/constants';
import type {CliCapabilityProfile} from './profiles';
import type {RoomState} from './store-types';

const STABLE_SQLROOMS_CLI_AI_INSTRUCTIONS = `
In the SQLRooms CLI app, a Worksheet is a block document artifact. When the user asks to create, edit, inspect, or add content to a worksheet, target the current worksheet artifact using block-document commands and block-document agent tools. Use the word Worksheet in user-facing replies, but use block-document tool names and command IDs when invoking tools. The artifact type may still be "worksheet"; its editable content model is a block document.

When the user's primary context artifact is a worksheet or dashboard and they ask to add, update, or create a visualization, chart, or dashboard surface, mutate that artifact through the appropriate agent tool instead of creating a separate artifact, chat-only chart, or markdown image.

- Use ${CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME} when the primary artifact is a worksheet, or when the user explicitly asks to create/edit a top-level worksheet artifact.
- If run context contains a kind:"block" item, call ${CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME} with blockDocumentId from that item and targetBlock = {blockId, blockType, blockInstanceId}. The user is asking about that exact worksheet block; do not retarget another block.
- For dashboard artifacts, call dashboard_agent.
- Use the standalone chart and chart_image_for_markdown tools only when the user wants an inline chat visualization or no target artifact is available.
`;

const EXPERIMENTAL_SQLROOMS_CLI_AI_INSTRUCTIONS = `
Experimental SQLRooms tools are available in this session. Use them for app, map, and generated interactive visualization requests when they match the user's target artifact.

- If the primary artifact is a worksheet and the user asks for an app, HTML app, D3 app, Chart.js app, browser app, or generated interactive visualization inside it, call ${CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME}. The worksheet agent should create/reuse the worksheet html-app block, then call embedded_html_app_agent with the block's appId.
- Do not use top-level html_app_agent to populate worksheet stateful blocks inside worksheets.
- For worksheet map requests, call ${CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME}. It should add or reuse a direct worksheet map block, not create a dashboard block just to hold the map.
- For generated HTML, D3, Chart.js, or browser app visualizations only when the primary artifact is an html-app artifact or no worksheet/dashboard artifact is the requested target, write through html_app_agent. html_app_agent requires appId and never creates artifacts or worksheet blocks.
- If the primary artifact is an html-app artifact, call html_app_agent with appId set to the current artifact id and update it instead of creating a new html-app artifact.
- For incremental edits to an existing html-app artifact, such as changing title, labels, colors, styles, layout, controls, or interactions, call html_app_agent directly with the current appId and the user's edit request. Do not inspect tables or schemas first unless the user explicitly asks to change the app's data/query behavior.
- If a new top-level html-app artifact is needed, first execute the html-app.create-artifact command, then call html_app_agent with appId set to the returned artifactId.
- For HTML app undo, redo, or restoring an earlier version, use list_commands and execute_command with html-app.undo-revision, html-app.redo-revision, or html-app.restore-revision. Do not rewrite, delete, or edit chat messages to perform app undo/redo.
- If an embedded worksheet HTML app target is ambiguous, ask the user to select the app/block or provide appId instead of mutating a guessed app.
`;

const WORKSHEET_CHARTS_MAPS_AI_INSTRUCTIONS = `
This SQLRooms session exposes worksheet artifacts with text, chart, and direct map blocks.

- Use ${CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME} for worksheet creation, analysis, charts, maps, block edits, and block reordering.
- If run context contains a kind:"block" item, pass its blockDocumentId and targetBlock fields unchanged so only that worksheet block is edited.
- For worksheet maps, use the worksheet agent's direct map tool. Preserve existing map datasets and layers for incremental edits.
- Use standalone chart tools only for inline chat visualizations or when no worksheet target is available.
`;

const WORKSHEET_AGENT_ROUTING_INSTRUCTIONS = `
The ${CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME} tool edits an existing Worksheet and requires its blockDocumentId; it does not create the Worksheet artifact container.

- An explicit request to create a new Worksheet takes precedence over any Worksheet artifact ID in run context. For that request, use the command tools to execute block-document.create exactly once, then use the returned result.data.artifactId as the new blockDocumentId.
- Delegate requested block types exposed by the current profile's ${CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME} to it. This includes text and charts, plus maps, dashboards, data tables, or HTML apps when the tool description lists them. For Worksheet block types that the tool does not expose, such as Python, pivot, document, or SQL-query blocks, use the corresponding registered block-document commands after creating the container.
- After creating the Worksheet container, do not create its requested chart or map blocks through generic block-document commands. The Worksheet agent owns those block writes and has the specialized authoring contracts needed to produce valid content.
- When the user asks to edit or add content to an existing Worksheet and its artifact ID is available in run context, call ${CLI_BLOCK_DOCUMENT_AGENT_TOOL_NAME} with that ID directly and do not create another Worksheet.
`;

/** Builds the production CLI assistant instructions for a capability profile. */
export function createCliAiInstructions(
  store: StoreApi<RoomState>,
  profile: CliCapabilityProfile,
): string {
  return [
    createDefaultAiInstructions(store),
    profile.name === 'worksheet-charts-maps'
      ? WORKSHEET_CHARTS_MAPS_AI_INSTRUCTIONS.trim()
      : STABLE_SQLROOMS_CLI_AI_INSTRUCTIONS.trim(),
    WORKSHEET_AGENT_ROUTING_INSTRUCTIONS.trim(),
    profile.ai.instructionSets.includes('experimental')
      ? EXPERIMENTAL_SQLROOMS_CLI_AI_INSTRUCTIONS.trim()
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
