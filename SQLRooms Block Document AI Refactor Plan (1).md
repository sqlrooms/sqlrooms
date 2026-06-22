# SQLRooms Block Document AI Refactor Plan

Date: 2026-06-21
Status: Proposed
Repo: `/Users/iboyandin/.codex/worktrees/bda0/sqlrooms`

## Goal

Move the AI functionality currently under `packages/mosaic/src/ai/worksheet` to the packages that own the relevant concepts, and remove `Worksheet` naming from shared SQLRooms packages.

`worksheet` should remain a client/app artifact term in `apps/sqlrooms-cli-ui`. Shared packages should use `BlockDocument`, `statefulBlock`, or package-specific names such as `HtmlApp`, `MosaicDashboard`, and `DataTableExplorer`.

## Current Problem

`packages/mosaic/src/ai/worksheet` mixes at least four ownership domains:

1. Generic block-document behavior from `@sqlrooms/documents`.
2. HTML app runtime behavior from `@sqlrooms/app-runtime`.
3. Mosaic chart, dashboard, and data-table-explorer behavior from `@sqlrooms/mosaic`.
4. CLI artifact language and orchestration policy from `apps/sqlrooms-cli-ui`.

This makes Mosaic look like it owns the worksheet artifact and also leaks the CLI app term `worksheet` into reusable package APIs.

## Target Vocabulary

Use these names in packages:

- `BlockDocumentAiAdapter` instead of `WorksheetAiAdapter`.
- `blockDocumentId` or `artifactId` instead of `worksheetId`.
- `createBlockDocumentAgentTool` only for a generic documents-owned agent, if one exists.
- `createWorksheetAgentTool` only in the CLI app, where `worksheet` is a real artifact type.
- `create_block_document_chart_*` or `create_block_document_chart_block_*` instead of `create_worksheet_block_*`.
- `list_block_document_blocks` instead of `list_worksheet_blocks`.

The CLI can still expose a tool named `worksheet_agent` if that is the user-facing artifact tool. The shared package APIs should not use `Worksheet` names.

## Target Package Ownership

### `@sqlrooms/documents`

Owns generic block-document AI primitives:

- Generic adapter type for ensuring, selecting, reading, and appending block-document blocks.
- Generic text block creation tools.
- Generic block listing and block summarization.
- Generic result and extension-tool factory types, if they are not app-specific.

Proposed files:

- `packages/documents/src/ai/BlockDocumentAiAdapter.ts`
- `packages/documents/src/ai/createAddBlockDocumentTextBlockTool.ts`
- `packages/documents/src/ai/createListBlockDocumentBlocksTool.ts`
- `packages/documents/src/ai/blockDocumentAiTypes.ts`
- export from `packages/documents/src/index.ts`, or add a `@sqlrooms/documents/ai` subpath if the AI surface grows.

### `@sqlrooms/app-runtime`

Owns HTML app block construction and HTML app runtime semantics:

- Pure helper for creating an owned `html-app` stateful block for a block document.
- Optionally the AI tool wrapper that creates an HTML app block, if `@sqlrooms/app-runtime` is allowed to depend on `ai`.

Recommended low-coupling shape:

- Add pure helper in `packages/app-runtime/src/html-app.tsx` or a small sibling module:
  - `createHtmlAppBlockDocumentBlock({ title, intent, height })`
- Keep the AI tool wrapper in the CLI app or a lightweight AI integration layer if we do not want `@sqlrooms/app-runtime` to depend on `ai`.

If the `ai` dependency is acceptable in `@sqlrooms/app-runtime`, create:

- `packages/app-runtime/src/ai/createAddHtmlAppBlockTool.ts`
- exported as `createAddHtmlAppBlockDocumentTool`.

### `@sqlrooms/mosaic`

Owns only Mosaic-specific block-document integrations:

- Chart block tools and chart block renderer.
- Dashboard stateful-block creation when it creates Mosaic dashboard runtime state.
- Data Table Explorer block tools while Data Table Explorer remains in Mosaic.

Proposed files:

- `packages/mosaic/src/ai/block-document/createBlockDocumentChartTools.ts`
- `packages/mosaic/src/ai/block-document/createAddMosaicDashboardBlockTool.ts`
- `packages/mosaic/src/ai/block-document/createBlockDocumentDataTableExplorerTool.ts`

Avoid `worksheet` in paths, type names, comments, tool descriptions, and exported APIs.

### `apps/sqlrooms-cli-ui`

Owns worksheet artifact orchestration:

- `worksheet` artifact type and labels.
- `worksheet_agent` tool name, if preserved for UX and prompt compatibility.
- Mapping from a worksheet artifact to a block document.
- Composition of documents, Mosaic, HTML app, dashboard, and host-specific tools.
- Product-specific agent instructions that say when to create charts, dashboards, maps, or HTML apps inside a worksheet.

Proposed files:

- Keep `apps/sqlrooms-cli-ui/src/createWorksheetAgent.ts` as the CLI-facing wrapper.
- Rename `createWorksheetAiAdapter.ts` internally or replace it with `createBlockDocumentArtifactAiAdapter.ts` and let the wrapper validate `artifact.type === 'worksheet'`.
- Move the current orchestration from Mosaic into the CLI app as `createWorksheetBlockDocumentAgentTool` or keep the exported CLI wrapper named `worksheetAgentTool`.

## File-by-File Disposition

### `packages/mosaic/src/ai/worksheet/worksheet-types.ts`

Current role:

- Defines `WorksheetAiAdapter`, `WorksheetAgentResult`, extra-tool factory types, and `CreateWorksheetAgentToolOptions`.
- Also bakes dashboard and data-table creation into the adapter.

Target:

- Split into generic document types and package/app-specific extension types.

Move generic pieces to `@sqlrooms/documents`:

- `BlockDocumentAiAdapter`
- `BlockDocumentAgentResult`
- `ExtraBlockDocumentAiToolsFactory`
- `ExtraBlockDocumentAiToolsParams`

Suggested adapter:

```ts
export type BlockDocumentAiAdapter = {
  setCurrentBlockDocument?(blockDocumentId: string): void;
  ensureBlockDocument(blockDocumentId: string): void;
  getBlocks(blockDocumentId: string): BlockDocumentNode[] | undefined;
  addBlock(blockDocumentId: string, block: BlockDocumentBlock): string;
};
```

Do not include `addDashboardBlock` or `addDataTableExplorerBlock` in the generic adapter. Those are capability-specific and should become tool-local callbacks.

Move or rewrite `CreateWorksheetAgentToolOptions` in the CLI app as a worksheet artifact orchestration type, or rename it to `CreateBlockDocumentAgentToolOptions` only if it becomes truly generic.

Compatibility:

- Add deprecated aliases in Mosaic temporarily only if downstream users import these names.
- Prefer quickly migrating app imports from `@sqlrooms/mosaic/ai` to `@sqlrooms/documents` plus app-local types.

### `packages/mosaic/src/ai/worksheet/constants.ts`

Current role:

- Defines `WORKSHEET_CHART_TOOL_PREFIX = 'create_worksheet_block_'`.
- Defines `KnownWorksheetTools` with document, Mosaic, app-runtime, and embedded-agent tool names.

Target:

- Split by package owner.

Move to `@sqlrooms/documents`:

```ts
export const BLOCK_DOCUMENT_TEXT_TOOL_NAME = 'add_block_document_text_block';
export const BLOCK_DOCUMENT_LIST_BLOCKS_TOOL_NAME =
  'list_block_document_blocks';
```

Keep in `@sqlrooms/mosaic`:

```ts
export const BLOCK_DOCUMENT_CHART_TOOL_PREFIX = 'create_block_document_chart_';
export const ADD_MOSAIC_DASHBOARD_BLOCK_TOOL_NAME =
  'add_mosaic_dashboard_block';
export const ADD_DATA_TABLE_EXPLORER_BLOCK_TOOL_NAME =
  'add_data_table_explorer_block';
```

Move to `@sqlrooms/app-runtime` or CLI integration layer:

```ts
export const ADD_HTML_APP_BLOCK_TOOL_NAME = 'add_html_app_block';
```

Keep in CLI app orchestration:

```ts
export const WORKSHEET_AGENT_TOOL_NAME = 'worksheet_agent';
export const EMBEDDED_DASHBOARD_AGENT_TOOL_NAME = 'embedded_dashboard_agent';
export const EMBEDDED_HTML_APP_AGENT_TOOL_NAME = 'embedded_html_app_agent';
```

Compatibility:

- During migration, support both old and new chart tool prefixes if old transcripts or tests depend on `create_worksheet_block_*`.

### `packages/mosaic/src/ai/worksheet/createAddTextBlockTool.ts`

Current role:

- Creates generic block-document heading, paragraph, and list blocks.
- Has no Mosaic dependency.

Target:

- Move to `@sqlrooms/documents`.
- Rename to `createAddBlockDocumentTextBlockTool`.
- Rename options to `CreateAddBlockDocumentTextBlockToolOptions`.
- Use `blockDocumentAdapter` and `blockDocumentId`.

Package owner:

- `packages/documents/src/ai/createAddBlockDocumentTextBlockTool.ts`

Potential cleanup:

- Export the pure `createTextBlock` helper as `createBlockDocumentTextBlock` if useful for commands or non-AI callers.
- Keep tool output generic: `{ success: true, blockId, message }`.

### `packages/mosaic/src/ai/worksheet/createListWorksheetBlocksTool.ts`

Current role:

- Lists existing blocks.
- Hardcodes `dashboardId` and `htmlAppId` summaries for stateful blocks.

Target:

- Move generic listing to `@sqlrooms/documents`.
- Rename to `createListBlockDocumentBlocksTool`.
- Use generic summary fields instead of dashboard/html-app-specific aliases.

Suggested generic summary:

```ts
type BlockDocumentBlockSummary = {
  blockId: string;
  type: string;
  title?: string;
  caption?: string;
  tableName?: string;
  statefulBlock?: {
    blockType: string;
    blockInstanceId?: string;
    ownership?: 'owned' | 'external';
  };
};
```

Then CLI instructions can say:

- If `statefulBlock.blockType === 'dashboard'`, pass `statefulBlock.blockInstanceId` to `embedded_dashboard_agent`.
- If `statefulBlock.blockType === 'html-app'`, pass `statefulBlock.blockInstanceId` to `embedded_html_app_agent`.

This keeps the document package generic while still making agent reuse possible.

Package owner:

- `packages/documents/src/ai/createListBlockDocumentBlocksTool.ts`

### `packages/mosaic/src/ai/worksheet/createAddHtmlAppBlockTool.ts`

Current role:

- Creates an owned `statefulBlock` with `blockType: 'html-app'`.
- Has no Mosaic dependency.
- Clearly does not belong in Mosaic.

Target:

- Move HTML app block construction to `@sqlrooms/app-runtime`.
- Rename away from worksheet terms.

Preferred split:

1. In `@sqlrooms/app-runtime`, add a pure helper:

```ts
export function createHtmlAppBlockDocumentBlock(options: {
  title: string;
  intent?: string;
  height?: number;
  appId?: string;
  blockId?: string;
}): {appId: string; block: BlockDocumentStatefulBlockBlock};
```

2. Put the AI tool wrapper either:

- in `@sqlrooms/app-runtime` as `createAddHtmlAppBlockDocumentTool` if accepting an `ai` dependency is okay, or
- in `apps/sqlrooms-cli-ui` using the app-runtime helper if app-runtime should remain runtime-only.

Recommended first step:

- Add the pure helper to `@sqlrooms/app-runtime`.
- Move the AI tool wrapper into `apps/sqlrooms-cli-ui` until there is a broader decision about package-level AI dependencies outside Mosaic.

### `packages/mosaic/src/ai/worksheet/createAddDashboardBlockTool.ts`

Current role:

- Creates an empty dashboard block by delegating to `worksheetAdapter.addDashboardBlock`.
- The real ownership is Mosaic dashboard runtime, not generic documents.

Target:

- Keep in `@sqlrooms/mosaic`, but move from `ai/worksheet` to `ai/block-document`.
- Rename to `createAddMosaicDashboardBlockTool` or `createAddBlockDocumentDashboardBlockTool`.
- Remove dashboard creation from the generic block-document adapter.
- Accept a callback that owns Mosaic dashboard state creation.

Suggested API:

```ts
export type CreateAddMosaicDashboardBlockToolOptions = {
  blockDocumentAdapter: BlockDocumentAiAdapter;
  blockDocumentId: string;
  createDashboardBlock: (params: {
    title: string;
    tableName: string;
    intent?: string;
  }) => {dashboardId: string; block: BlockDocumentStatefulBlockBlock};
};
```

The CLI app can implement `createDashboardBlock` by calling `state.mosaicDashboard.createDashboard(title)` and `state.mosaicDashboard.setSelectedTable(...)`.

### `packages/mosaic/src/ai/worksheet/createWorksheetChartTools.ts`

Current role:

- Creates Mosaic chart blocks in a block document.
- Depends on Mosaic chart tool machinery and `@sqlrooms/documents` block types.

Target:

- Keep in `@sqlrooms/mosaic`.
- Move to `packages/mosaic/src/ai/block-document/createBlockDocumentChartTools.ts`.
- Rename `CreateWorksheetChartToolsParams` to `CreateBlockDocumentChartToolsParams`.
- Use `blockDocumentAdapter` and `blockDocumentId`.
- Rename chart tool prefix to avoid worksheet.

Suggested prefix:

- `create_block_document_chart_` if the generated tool creates chart blocks.
- Avoid `create_block_document_block_` because it reads awkwardly and hides that the capability is chart-specific.

Compatibility:

- Optionally expose deprecated `createWorksheetChartTools` as an alias during one release cycle.

### `packages/mosaic/src/ai/worksheet/createWorksheetDataTableExplorerTool.ts`

Current role:

- Wraps Mosaic `createDataTableExplorerTool` and inserts a data-table stateful block into a worksheet.
- Data Table Explorer currently lives in Mosaic, so this is Mosaic-owned for now.

Target:

- Keep in `@sqlrooms/mosaic` while Data Table Explorer remains there.
- Move to `packages/mosaic/src/ai/block-document/createBlockDocumentDataTableExplorerTool.ts`.
- Rename types to `CreateBlockDocumentDataTableExplorerToolParams`.
- Replace `worksheetAdapter.addDataTableExplorerBlock(...)` with a local callback or direct `blockDocumentAdapter.addBlock(...)` after constructing the stateful block.

Longer-term option:

- If Data Table Explorer becomes its own package, move this tool there with the renderer and block definition.

### `packages/mosaic/src/ai/worksheet/createWorksheetAiTools.ts`

Current role:

- Composes document text/listing tools, Mosaic chart/dashboard/data-table tools, app-runtime HTML app tools, embedded dashboard agent, and host extra tools.
- This is orchestration, not Mosaic core.

Target:

- Move to `apps/sqlrooms-cli-ui` or rewrite as app-owned composition.
- Rename package-free concepts to `createBlockDocumentAiTools` if used internally.
- Keep CLI-facing wrapper names involving worksheet only in the app layer.

Recommended app-owned shape:

```ts
function createWorksheetArtifactBlockDocumentTools({
  blockDocumentAdapter,
  blockDocumentId,
  databaseAdapter,
  dashboardAgentTool,
  htmlAppAgentTool,
  chartToolsOptions,
  extraTools,
}: ...): Record<string, Tool>
```

Inside it, compose:

- `@sqlrooms/documents` text/listing tools.
- `@sqlrooms/mosaic` chart/dashboard/data-table block tools.
- app-runtime/CLI HTML app block tool.
- embedded dashboard/html-app agents.

### `packages/mosaic/src/ai/worksheet/createWorksheetAgentTool.ts`

Current role:

- Product-specific multi-step agent for creating data analysis worksheets.
- Hardcodes worksheet vocabulary, chart-first behavior, dashboard delegation, map delegation, HTML app delegation, and CLI artifact assumptions.
- Depends on Mosaic store constraints through `TState extends MosaicDashboardStoreState`.

Target:

- Move to `apps/sqlrooms-cli-ui` as the worksheet artifact agent implementation.
- Keep the CLI-facing tool name `worksheet_agent` if desired.
- Internally use `BlockDocument` terms for the reusable mechanics.
- Do not export this from `@sqlrooms/mosaic/ai`.

Alternative if a generic package-level agent is desired:

- Create a minimal `@sqlrooms/documents` `createBlockDocumentAgentTool` that knows only how to call supplied tools and append generic blocks.
- Put all SQLRooms worksheet product policy in the CLI app as instructions and tool composition.

Recommended first step:

- Move the current concrete agent to `apps/sqlrooms-cli-ui` because it is not generic enough for `@sqlrooms/documents`.

## Migration Sequence

### Phase 1: Introduce generic document APIs

1. Add `BlockDocumentAiAdapter` and generic tool types to `@sqlrooms/documents`.
2. Add `createAddBlockDocumentTextBlockTool` to `@sqlrooms/documents`.
3. Add `createListBlockDocumentBlocksTool` to `@sqlrooms/documents` with generic stateful-block summaries.
4. Export these from `@sqlrooms/documents`.
5. Add tests in `packages/documents` for text block creation and block summaries.

### Phase 2: Move HTML app block construction out of Mosaic

1. Add `createHtmlAppBlockDocumentBlock` to `@sqlrooms/app-runtime`.
2. Move or recreate the AI wrapper outside Mosaic.
3. Update CLI worksheet agent composition to use the app-runtime helper/tool.
4. Add tests in `packages/app-runtime` for block construction.

### Phase 3: Rename Mosaic block-document integrations

1. Create `packages/mosaic/src/ai/block-document`.
2. Move and rename chart, dashboard, and data-table-explorer tools:
   - `createWorksheetChartTools` -> `createBlockDocumentChartTools`
   - `createAddDashboardBlockTool` -> `createAddMosaicDashboardBlockTool`
   - `createWorksheetDataTableExplorerTool` -> `createBlockDocumentDataTableExplorerTool`
3. Replace `worksheetId` with `blockDocumentId` and `worksheetAdapter` with `blockDocumentAdapter`.
4. Rename chart tool prefix from `create_worksheet_block_` to `create_block_document_chart_`.
5. Keep deprecated aliases only if needed for downstream compatibility.

### Phase 4: Move orchestration to the CLI app

1. Move `createWorksheetAiTools` composition to `apps/sqlrooms-cli-ui`.
2. Move `createWorksheetAgentTool` to `apps/sqlrooms-cli-ui` or rewrite `createWorksheetAgent.ts` to own the orchestration directly.
3. Replace `createWorksheetAiAdapter` import from `@sqlrooms/mosaic/ai` with `BlockDocumentAiAdapter` from `@sqlrooms/documents`.
4. Keep app-level `worksheet` artifact names in CLI code and user-facing prompts.
5. Remove package-level `Worksheet*` exports from `@sqlrooms/mosaic/ai` once callers are migrated.

### Phase 5: Cleanup and documentation

1. Update `packages/mosaic/src/ai.ts` and `packages/mosaic/src/index.ts` exports.
2. Update `packages/mosaic/README.md` to replace worksheet package-language with block-document integration language.
3. Update `packages/documents/README.md` if new public AI APIs are exported.
4. Update `packages/app-runtime/README.md` to mention embedded `html-app` block construction.
5. Update CLI README only where user-facing worksheet behavior changes.
6. Run package tests and typechecks.

## Compatibility Strategy

Prefer a staged rename over a hard break:

1. Introduce new `BlockDocument*` exports.
2. Update internal SQLRooms app imports.
3. Leave deprecated Mosaic aliases for one release only if public API compatibility matters.
4. Remove aliases after downstream callers are migrated.

Deprecated aliases, if kept, should be shallow and documented:

```ts
/** @deprecated Use createBlockDocumentChartTools. */
export const createWorksheetChartTools = createBlockDocumentChartTools;
```

Avoid preserving old agent prompt text. The prompt should be rewritten because it is app-specific and currently reinforces the wrong ownership model.

## Tests to Update or Add

- Move `packages/mosaic/__tests__/worksheet-ai.test.ts` into package-specific tests:
  - document text/listing tests in `packages/documents`.
  - HTML app block construction tests in `packages/app-runtime`.
  - Mosaic chart/dashboard/data-table block integration tests in `packages/mosaic`.
  - worksheet agent orchestration tests in `apps/sqlrooms-cli-ui`, if that app has test setup.
- Update imports in existing Mosaic tests from `../src/ai/worksheet/...` to `../src/ai/block-document/...`.
- Add coverage for generic stateful block summaries to avoid reintroducing dashboard/html-app-specific fields in `@sqlrooms/documents`.

## Validation Commands

From the repo root:

```sh
pnpm --filter @sqlrooms/documents test
pnpm --filter @sqlrooms/app-runtime test
pnpm --filter @sqlrooms/mosaic test
pnpm --filter @sqlrooms/documents typecheck
pnpm --filter @sqlrooms/app-runtime typecheck
pnpm --filter @sqlrooms/mosaic typecheck
```

If CLI tests/typecheck exist, also run the relevant `apps/sqlrooms-cli-ui` command.

## Open Questions

1. Should `@sqlrooms/app-runtime` accept an `ai` dependency, or should it expose only pure helpers and let the CLI own AI wrappers?
2. Do we need a temporary compatibility layer for `create_worksheet_block_*` tool names because saved agent instructions or tests refer to them?
3. Should `@sqlrooms/documents` add a dedicated `./ai` export subpath, or keep the first few AI helpers in the main export?
4. Should Data Table Explorer be split out of Mosaic eventually, since it is not fundamentally tied to Mosaic charts?
5. Should the CLI continue exposing `worksheet_agent`, or should it be renamed to `block_document_agent` while keeping Worksheet as only the artifact label?

## Recommendation

Do the refactor in this order:

1. Move generic text/listing tools to `@sqlrooms/documents`.
2. Move HTML app block construction to `@sqlrooms/app-runtime` and the AI wrapper out of Mosaic.
3. Rename Mosaic's remaining worksheet directory to `ai/block-document` and keep only Mosaic-owned integrations there.
4. Move the concrete worksheet agent and tool composition into `apps/sqlrooms-cli-ui`.
5. Update docs and tests, then remove or deprecate the old Mosaic `Worksheet*` exports.

This keeps package ownership honest: documents owns block documents, app-runtime owns HTML apps, Mosaic owns Mosaic visual integrations, and the CLI app owns the Worksheet artifact concept.
