# Analysis Document Artifacts

## Goal

Introduce a new parent artifact type in `@sqlrooms/documents` for Notion-like,
block-composed analytical documents.

Recommended product/API name:

- Persisted artifact type: `analysis`
- User-visible label: `Analysis`
- Package-facing terms: `AnalysisDocument`, `AnalysisBlock`

`Analysis` is short, domain-specific, and broad enough to contain narrative,
charts, images, lists, and embedded interactive artifacts. It avoids overloading
the existing Markdown `document` artifact, and it feels less final/static than
`Report`.

The new artifact should support:

- Rich text blocks.
- Headings, paragraphs, lists, todos, quotes, code, dividers, and images.
- Standalone vgplot-based chart blocks that reuse the same chart
  implementations and settings UI as Mosaic dashboard chart panels.
- Chart/image blocks that can be AI-authored.
- Embedded artifact blocks, starting with Mosaic dashboard artifacts.
- Multiple embedded dashboards in one analysis artifact, each with independent
  backing state and runtime behavior.
- Independent crossfilter scopes for standalone chart blocks and embedded
  dashboards, with optional chart groups when analysis chart blocks should
  crossfilter together.
- AI commands/tools that can create an analysis, read it, append/reorder/remove
  blocks, and create/embed dashboard blocks.

## Non-Goals

- Do not replace the existing Markdown `document` artifact in the first pass.
- Do not migrate existing Markdown documents automatically.
- Do not build a complete Notion clone: no page database, backlinks, comments,
  permissions, templates, or arbitrary nested pages in the initial feature.
- Do not support every artifact type as an embed in v1. Start with dashboards.
- Do not introduce eager table/materialization conversions for chart blocks.
- Do not make embedded dashboards share state implicitly. Sharing must be
  explicit through the referenced artifact or data source.
- Do not require AI to be configured for manual creation/editing.

## Current Architecture Findings

### Artifacts

- `@sqlrooms/artifacts` owns artifact metadata and tab/layout integration.
- `ArtifactMetadata` currently has only `id`, `type`, and `title`.
- `createArtifactsSlice` manages `artifactsById`, `artifactOrder`, and
  `currentArtifactId`.
- Artifact type definitions are runtime app configuration with lifecycle hooks
  (`onCreate`, `onEnsure`, `onRename`, `onClose`, `onDelete`).
- `ArtifactTabs` renders artifacts from `artifactOrder` and can filter by type,
  but there is no first-class hidden/embedded child artifact concept.
- `createArtifactPanelDefinition` resolves artifact panels from artifact type
  definitions, so any new top-level analysis artifact should integrate cleanly.

### Documents

- `@sqlrooms/documents` currently implements Markdown document artifacts.
- Document state is stored in `documents.config.artifacts[artifactId]` as
  `{id, markdown, assets, updatedAt}`.
- Assets are document-owned PNG/SVG payloads referenced by `asset://...`.
- `MarkdownDocument` is a controlled Tiptap editor with Markdown as canonical
  persisted state.
- `createDocumentCommands()` exposes AI/palette-friendly commands:
  `document.list`, `document.get`, `document.create`,
  `document.set-markdown`, and `document.append-markdown`.
- `createDocumentsCrdtMirror()` syncs only Markdown document artifacts and their
  artifact metadata.
- The package name is `@sqlrooms/documents`, not `@sqlrooms/document`.

### Dashboards

- Mosaic dashboard state lives in `mosaicDashboard.config.dashboardsById`.
- Dashboards are already keyed by artifact/dashboard id.
- `MosaicDashboard` accepts `dashboardId` and uses context to render a toolbar
  and panels.
- Dashboard runtime state is keyed by
  `dashboard:${dashboardId}:panel:${panelId}`.
- Selection state uses `getMosaicDashboardSelectionName(dashboardId)`, so two
  dashboards with different ids are naturally independent.
- `mosaicDashboard.removeDashboard` evicts retained charts and runtime issues.
- Dashboard artifact lifecycle in the CLI UI already ensures/removes backing
  dashboard state.

### AI and Commands

- `@sqlrooms/artifacts/ai` provides context-aware tools for listing/reading
  artifacts and making an artifact primary for an AI run.
- `@sqlrooms/mosaic/ai` provides reusable dashboard tools and
  `dashboard_agent`.
- The CLI UI wires document commands, dashboard commands/tools, artifact
  context tools, and default AI tools together in `apps/sqlrooms-cli-ui`.
- CLI artifact readers currently return full payloads for Markdown documents
  and dashboards.
- Command adapters in `@sqlrooms/room-store` are the preferred bridge for
  palette/MCP/AI command execution.

## Proposed Implementation Approach

Add a structured analysis document model alongside, not inside, the existing
Markdown document model.

### Data Model

Add new schemas under `@sqlrooms/documents`, likely in files such as
`AnalysisDocumentSliceConfig.ts`:

```ts
type AnalysisDocument = {
  id: string;
  content: AnalysisDocumentContent;
  updatedAt: number;
};

type AnalysisDocumentContent = {
  type: 'doc';
  content?: AnalysisDocumentNode[];
};

type AnalysisDocumentNode =
  | TiptapTextBlockNode
  | AnalysisChartNode
  | AnalysisArtifactEmbedNode
  | AnalysisImageNode;
```

The preferred canonical body for `analysis` should be Tiptap/ProseMirror JSON,
not a parallel home-grown `blocks[]` array. The command and AI APIs can expose
block-shaped DTOs, but the persisted document should be the same tree the rich
editor edits. This avoids lossy conversion once users start mixing rich text,
tables, captions, and custom interactive blocks.

For command/AI readability, define a block DTO shape that maps onto top-level
Tiptap nodes:

```ts
type AnalysisBlock =
  | {id: string; type: 'heading'; level: 1 | 2 | 3; text: string}
  | {id: string; type: 'paragraph'; text: string}
  | {id: string; type: 'richText'; markdown: string}
  | {id: string; type: 'list'; ordered?: boolean; items: string[]}
  | {id: string; type: 'todo'; checked: boolean; text: string}
  | {id: string; type: 'image'; assetId: string; caption?: string}
  | {id: string; type: 'chartImage'; assetId: string; caption?: string}
  | {
      id: string;
      type: 'chart';
      tableName: string;
      config: ChartConfig;
      selectionGroupId?: string;
      caption?: string;
    }
  | {id: string; type: 'artifactEmbed'; artifactId: string; artifactType: string};
```

Each top-level editable block node must have a stable `id` attribute. Use the
Tiptap `UniqueID` extension, configured with SQLRooms' id generator, to backfill
missing ids and avoid duplicate ids after paste/collaboration merges.

Keep block DTO content intentionally simple at first. For rich text exposed to
AI, serialize individual Tiptap text blocks to Markdown strings. Internally,
keep Tiptap JSON so manual editing has a native model for marks, tables, nested
lists, and future custom containers.

### Tiptap Rich Editor Architecture

Build the analysis editor as a new Tiptap editor, separate from the existing
Markdown-controlled `MarkdownDocumentEditor`.

Recommended package files:

- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentEditorRoot.tsx`
- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentEditorContent.tsx`
- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentToolbar.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisChartNode.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisArtifactEmbedNode.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisImageNode.tsx`
- `packages/documents/src/AnalysisChartRendererContext.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/analysisMarkdown.ts`

The editor should use:

- `StarterKit` for paragraphs, headings, lists, blockquotes, code blocks,
  history, and standard marks.
- Existing table extensions if analysis documents should support rich tables in
  v1.
- `Link`, `TaskList`, and `TaskItem`, matching the existing Markdown document
  editor where useful.
- `UniqueID` for stable top-level block ids.
- Optional `DragHandle` later for Notion-like block handles. Do not make drag
  handles part of the first correctness milestone unless the editor UX needs it.

This likely requires adding `@tiptap/extension-unique-id` to
`@sqlrooms/documents`. Add `@tiptap/extension-drag-handle` only when drag
handles are implemented.

Use Tiptap custom nodes for SQLRooms blocks:

```ts
const AnalysisChartNode = Node.create({
  name: 'analysisChart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      id: {default: null},
      tableName: {default: null},
      config: {default: null},
      selectionGroupId: {default: null},
      caption: {default: null},
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(AnalysisChartNodeView);
  },
});
```

Use `ReactNodeViewRenderer` for interactive blocks. Node views should render a
`NodeViewWrapper` and keep controls `contentEditable={false}` so ProseMirror
does not try to edit buttons, menus, chart canvases, or dashboards. Use
`props.updateAttributes(...)` for small attribute edits like captions,
selected tables, chart config, or selection group changes. Use store commands
for mutations that create or delete related artifacts.

Because `@sqlrooms/mosaic` already depends on `@sqlrooms/documents`,
`@sqlrooms/documents` must not import Mosaic chart/dashboard components. The
analysis editor should own the Tiptap node schemas and generic NodeView shells,
then call host-provided renderer contexts:

- `AnalysisChartRendererContext` renders `analysisChart` nodes.
- `AnalysisArtifactEmbedRendererContext` renders artifact embed nodes.

The CLI UI can provide Mosaic-backed renderers for both standalone chart blocks
and dashboard embeds. Other host apps can provide different renderers or render
clear unsupported states.

Use `atom: true` for blocks that should behave as one selectable unit:

- standalone chart blocks
- dashboard/artifact embed blocks
- static image blocks if no rich caption is needed

Use a non-atom node with `content` plus `NodeViewContent` only when the block
needs editable nested rich text, for example a future callout block with rich
body content. Avoid putting a live dashboard inside a node with editable
`contentDOM`; that risks focus and selection interference.

Custom block node attributes should store only durable configuration:

- `analysisChart`: `id`, `tableName`, `config`, `selectionGroupId`, `caption`
- `analysisArtifactEmbed`: `id`, `artifactId`, `artifactType`, `caption`
- `analysisImage`: `id`, `assetId`, `alt`, `caption`, optional size attrs

Do not store live runtime objects in node attrs. Mosaic `Selection` instances,
retained chart handles, dashboard runtime issues, and asset object URLs should
remain in Zustand/runtime state keyed by stable node ids.

The editor `onUpdate` should persist `editor.getJSON()` to
`analysisDocuments.config.artifacts[artifactId].content`. To avoid echo loops,
mirror the existing Markdown editor pattern: hold `onChange` in a ref, compare
incoming content to current editor JSON before calling `setContent`, and update
read-only state with `editor.setEditable(...)`.

### Tiptap Serialization and AI Views

Manual editing should use Tiptap JSON as canonical state. AI and command tools
should read and write through a stable DTO layer:

- `analysis.get` returns top-level blocks as DTOs, including text rendered to
  concise Markdown and custom nodes rendered as structured metadata.
- `analysis.append-blocks` and `analysis.insert-blocks` convert DTOs to Tiptap
  JSON nodes and insert them into the document.
- `analysis.update-block` updates the top-level node with the matching `id`.
- `analysis.remove-block` deletes the matching top-level node.

Use `@tiptap/markdown` helpers for text-oriented blocks where possible. Tiptap
supports custom Markdown specs such as fenced block containers and atom block
containers. That gives us an optional Markdown/debug/export representation like:

```md
:::sqlrooms-chart {id="..." tableName="sales" selectionGroupId="overview"}
{...ChartConfig JSON...}
:::

:::sqlrooms-embed {id="..." artifactType="dashboard" artifactId="..."} :::
```

This Markdown representation should be an import/export and AI-debug surface,
not the primary persisted body for `analysis`. Keeping Tiptap JSON canonical
preserves interactive custom blocks without requiring every SQLRooms block to
round-trip through Markdown perfectly on day one.

### Standalone Chart Blocks

Analysis chart blocks should reuse the Mosaic/vgplot chart definitions,
`ChartConfig`, chart settings UI, spec generation, and `VgPlotChart` renderer
used by dashboard chart panels. They should not depend on `mosaicDashboard`
panel state.

The target extraction is a shared chart primitive, for example:

```ts
type MosaicChartViewProps = {
  tableName: string;
  config: ChartConfig;
  onConfigChange?: (config: ChartConfig) => void;
  selectionName?: string;
  retentionKey?: string;
  runtimeIssueKey?: string;
};
```

Dashboard chart panels and analysis chart blocks should both wrap this shared
primitive with their own chrome and persistence. Query-backed charts should
still use the Mosaic connection/coordinator; the decoupling is from dashboard
artifact/panel state, not from Mosaic's runtime.

Selection scoping rules:

- By default, a standalone chart block gets its own selection name, e.g.
  `analysis:${analysisId}:chart-block:${blockId}:brush`.
- If multiple standalone chart blocks should crossfilter together, they share a
  `selectionGroupId`, producing a name such as
  `analysis:${analysisId}:chart-group:${selectionGroupId}:brush`.
- Embedded dashboards keep using their dashboard-scoped selection name,
  `dashboard:${dashboardId}:brush`.
- The vgplot param name passed to specs can remain `brush`; independence comes
  from passing different `Selection` instances behind that param.

### Artifact Ownership

Extend artifact metadata with optional embedded-child metadata:

```ts
{
  parentArtifactId?: string;
  visibility?: 'workspace' | 'embedded';
}
```

Default `visibility` should be `workspace` for backward compatibility. Embedded
dashboard blocks should create normal dashboard artifacts with
`visibility: 'embedded'` and `parentArtifactId` set to the owning analysis id.
`ArtifactTabs` should omit `embedded` artifacts by default while still allowing
advanced callers to include them explicitly.

This keeps embedded dashboards on the same artifact/dashboard lifecycle path
without polluting the top-level workspace tabs.

### Rendering

Add an `AnalysisDocument` React component that hosts the Tiptap editor and
renders custom SQLRooms blocks through React NodeViews:

- Text/list blocks use document package UI.
- Image/chart image blocks reuse document asset resolution.
- Standalone chart blocks render the shared Mosaic/vgplot chart primitive with
  analysis-scoped persistence, retention, runtime issue, and selection keys.
- `artifactEmbed` with `artifactType: 'dashboard'` renders
  `<MosaicDashboard.Root dashboardId={artifactId}>` with dashboard toolbar and
  panels in an embedded block shell.
- Each embedded dashboard should pass only its own `dashboardId`, relying on
  Mosaic's existing dashboard-scoped runtime keys for independence.

To avoid making `@sqlrooms/documents` depend directly on `@sqlrooms/mosaic`,
prefer renderer registries:

```ts
type AnalysisChartRenderer = React.ComponentType<{
  analysisId: string;
  blockId: string;
  tableName: string;
  config: ChartConfig;
  selectionGroupId?: string;
  onConfigChange?: (config: ChartConfig) => void;
}>;

type AnalysisArtifactEmbedRenderer = {
  artifactType: string;
  component: React.ComponentType<{artifactId: string; parentArtifactId: string}>;
};
```

The CLI UI can register the Mosaic chart renderer and dashboard embed renderer.
This keeps the documents package generic and prevents a new package cycle.

### AI and Commands

Add analysis-specific commands, exported from `@sqlrooms/documents`:

- `analysis.list`
- `analysis.get`
- `analysis.create`
- `analysis.append-blocks`
- `analysis.insert-blocks`
- `analysis.update-block`
- `analysis.remove-block`
- `analysis.move-block`
- `analysis.create-chart-block`
- `analysis.embed-dashboard`

Add `ANALYSIS_AI_INSTRUCTIONS` and optionally `createAnalysisAgentTool(...)`.
The agent can orchestrate:

1. Create/read/update an analysis artifact.
2. Add standalone chart blocks for focused, lightweight visualizations.
3. Create one or more dashboard artifacts with the existing dashboard tools
   when a multi-panel interactive workspace is useful.
4. Embed the created dashboard artifacts as analysis blocks.
5. Add narrative summary blocks around charts and dashboard embeds.

Prefer commands for deterministic mutations and a dedicated agent for
multi-step authoring. This matches the existing split between document commands,
dashboard tools, and `dashboard_agent`.

### CRDT and Persistence

Extend the existing documents CRDT mirror or add a sibling mirror for analysis
documents. The mirror must sync:

- Analysis document Tiptap JSON content.
- Analysis assets.
- Analysis artifact metadata.
- Embedded child artifact metadata for dashboard blocks.

Dashboard backing state is not currently synced by the documents mirror. If
syncing embedded dashboards is required in the same feature, add or reuse a
Mosaic dashboard mirror in a later stage. Otherwise document that embedded
dashboards persist through the normal app persistence path and are not part of
document-only CRDT sync yet.

## Stages

Each stage should be reviewable as a separate commit.

### Stage 1: Structured Analysis State

Implement schemas and slice methods for analysis documents in
`@sqlrooms/documents`.

Likely changes:

- `packages/documents/src/AnalysisDocumentSliceConfig.ts`
- `packages/documents/src/AnalysisDocumentsSlice.ts`
- `packages/documents/src/index.ts`
- `packages/documents/__tests__/AnalysisDocumentsSlice.test.ts`
- `packages/documents/README.md`

Acceptance criteria:

- `AnalysisDocument` and Tiptap JSON content schemas parse persisted state.
- Block DTO helpers can map top-level Tiptap nodes to/from command-friendly
  `AnalysisBlock` values.
- Slice methods can ensure/remove an analysis document.
- Slice methods can append, insert, update, remove, and move blocks.
- IDs are stable and block ordering is deterministic.
- Existing Markdown document tests keep passing unchanged.

Checks:

- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/documents typecheck`

### Stage 2: Embedded Artifact Metadata

Add embedded-child metadata to artifact records and update artifact tab behavior.

Likely changes:

- `packages/artifacts/src/ArtifactsSliceConfig.ts`
- `packages/artifacts/src/ArtifactsSlice.ts`
- `packages/artifacts/src/artifactTabs.tsx`
- `packages/artifacts/__tests__/ArtifactsSlice.test.ts`
- `packages/artifacts/README.md`

Acceptance criteria:

- Existing artifact metadata without `visibility` still parses.
- New artifacts can be created/ensured with `visibility: 'embedded'` and
  `parentArtifactId`.
- `ArtifactTabs` hides embedded artifacts by default.
- Embedded artifacts can still be opened explicitly if a caller asks for them.
- Deleting a parent artifact does not accidentally delete unrelated artifacts.

Checks:

- `pnpm --filter @sqlrooms/artifacts test`
- `pnpm --filter @sqlrooms/artifacts typecheck`

### Stage 3: Tiptap Analysis Editor and Renderer Registry

Add the top-level `AnalysisDocument` component, Tiptap editor shell, custom
SQLRooms block node extensions, and a generic embed renderer registry.

Likely changes:

- `packages/documents/src/AnalysisDocument.tsx`
- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentEditorRoot.tsx`
- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentEditorContent.tsx`
- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentToolbar.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisChartNode.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisArtifactEmbedNode.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisImageNode.tsx`
- `packages/documents/src/AnalysisChartRendererContext.tsx`
- `packages/documents/src/AnalysisEmbedRendererContext.tsx`
- `packages/documents/package.json`
- `packages/documents/src/index.ts`
- `packages/documents/README.md`

Acceptance criteria:

- An analysis artifact renders editable rich text blocks through Tiptap.
- SQLRooms custom blocks render through React NodeViews.
- Chart and artifact NodeViews render through host-provided renderer contexts,
  not direct Mosaic imports.
- Unknown/missing embedded artifacts render a clear inline missing-state
  NodeView.
- The editor persists Tiptap JSON without echo loops when external state
  changes.
- The renderer registry allows host apps to provide dashboard rendering without
  `@sqlrooms/documents` importing `@sqlrooms/mosaic`.
- The component follows existing selector guidance: select stable raw state and
  derive arrays with `useMemo`.

Checks:

- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/documents typecheck`

### Stage 4: Shared Mosaic Chart Primitive

Extract dashboard chart internals into a reusable chart component that can be
used by dashboard panels and standalone analysis chart blocks.

Likely changes:

- `packages/mosaic/src/chart/MosaicChartView.tsx`
- `packages/mosaic/src/chart/MosaicChartSettingsPanel.tsx`
- `packages/mosaic/src/chart/useMosaicChartSelectionParams.ts`
- `packages/mosaic/src/chart/MosaicDashboardChart.tsx`
- `packages/mosaic/src/chart/MosaicDashboardChartContent.tsx`
- `packages/mosaic/src/chart/useBrushSelectionParams.tsx`
- `packages/mosaic/src/index.ts`
- `packages/mosaic/__tests__/*`

Acceptance criteria:

- Dashboard chart panels render through the shared primitive with unchanged
  behavior.
- The shared primitive accepts a caller-provided selection name and retention
  key rather than deriving them from `dashboardId` and `panelId`.
- The primitive can render a chart from `tableName` and `ChartConfig` without a
  dashboard entry.
- Runtime issues and retained vgplot instances remain scoped to the provided
  keys.
- Existing dashboard chart settings UI remains available and reusable.

Checks:

- `pnpm --filter @sqlrooms/mosaic test`
- `pnpm --filter @sqlrooms/mosaic typecheck`

### Stage 5: Standalone Analysis Chart Blocks

Wire standalone chart blocks into the analysis document renderer and state.

Likely changes:

- `packages/documents/src/AnalysisDocumentSliceConfig.ts`
- `packages/documents/src/AnalysisDocumentsSlice.ts`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisChartNode.tsx`
- `packages/documents/src/AnalysisDocumentEditor/node-views/AnalysisChartNodeView.tsx`
- `packages/documents/src/AnalysisChartRendererContext.tsx`
- `packages/documents/src/index.ts`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisChartRenderer.tsx`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisArtifact.tsx`
- `apps/sqlrooms-cli-ui/src/store.ts`

Acceptance criteria:

- Analysis documents can persist `analysisChart` Tiptap nodes with `tableName`,
  `ChartConfig`, optional caption, and optional `selectionGroupId`.
- A chart block renders using the same chart implementations and settings UI as
  dashboard chart panels through a CLI-provided Mosaic renderer.
- Two chart blocks without `selectionGroupId` do not crossfilter each other.
- Two chart blocks with the same `selectionGroupId` crossfilter each other.
- Standalone analysis chart selections do not affect embedded dashboard
  selections, and embedded dashboard selections do not affect standalone charts.

Checks:

- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/mosaic test`
- `pnpm --filter sqlrooms-cli-ui typecheck`

### Stage 6: CLI Integration and Dashboard Embeds

Register the `analysis` artifact type in the CLI UI and provide a dashboard
embed renderer.

Likely changes:

- `apps/sqlrooms-cli-ui/src/artifactTypes.tsx`
- `apps/sqlrooms-cli-ui/src/store-types.ts`
- `apps/sqlrooms-cli-ui/src/store.ts`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisArtifact.tsx`
- `apps/sqlrooms-cli-ui/src/workspace/dashboard/DashboardArtifact.tsx`
- `apps/sqlrooms-cli-ui/src/createArtifactContextAiTools.ts`

Acceptance criteria:

- Users can create an `Analysis` artifact from the artifact menu.
- Analysis artifacts persist and reopen.
- Analysis tabs show only the parent analysis artifact; embedded dashboards do
  not appear as top-level tabs by default.
- An analysis can contain two dashboard blocks with different dashboard ids.
- Filters/selections/runtime issues in one embedded dashboard do not affect the
  other embedded dashboard.
- Reading an analysis artifact as AI context returns block summaries and embed
  metadata.

Checks:

- `pnpm build`
- `pnpm --filter sqlrooms-cli-ui typecheck`
- Manual smoke test in the CLI UI after build:
  create analysis -> add two standalone chart blocks -> add two embedded
  dashboard blocks -> verify selection independence.

### Stage 7: Analysis Commands

Add command-registry operations for analysis documents.

Likely changes:

- `packages/documents/src/analysisCommands.ts`
- `packages/documents/src/index.ts`
- `packages/documents/__tests__/analysisCommands.test.ts`
- `packages/documents/README.md`
- `apps/sqlrooms-cli-ui/src/store.ts`

Acceptance criteria:

- Commands can list/read/create analysis artifacts.
- Commands can append/insert/update/remove/move blocks.
- `analysis.create-chart-block` can create a standalone chart block with a
  validated `ChartConfig`.
- `analysis.embed-dashboard` can create an embedded dashboard artifact or embed
  an existing dashboard artifact.
- Command outputs omit large asset payloads by default.
- Invalid block ids, artifact ids, and wrong artifact types return clear errors.

Checks:

- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/documents typecheck`
- `pnpm --filter sqlrooms-cli-ui typecheck`

### Stage 8: AI Authoring Tools and Agent

Expose analysis AI instructions and a dedicated authoring agent/tool.

Likely changes:

- `packages/documents/src/analysisAi.ts`
- `packages/documents/src/index.ts`
- `packages/documents/__tests__/analysisAi.test.ts`
- `apps/sqlrooms-cli-ui/src/store.ts`
- `apps/sqlrooms-cli-ui/src/createArtifactContextAiTools.ts`
- `apps/sqlrooms-cli-ui/src/createAnalysisAgent.ts`

Acceptance criteria:

- System instructions explain when to use analysis documents versus dashboards
  and Markdown documents.
- The assistant can create an analysis document with narrative text blocks.
- The assistant can create standalone chart blocks when a single focused chart
  is enough.
- The assistant can intentionally group standalone chart blocks with the same
  `selectionGroupId` when crossfiltering between them is useful.
- The assistant can call dashboard tools/agent, then embed the resulting
  dashboard artifact as a block.
- The assistant can append blocks to an existing primary analysis artifact.
- The assistant can read an analysis artifact from run context and target it
  without guessing ids.

Checks:

- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter sqlrooms-cli-ui typecheck`
- Manual AI smoke test with a configured model:
  "Create an analysis with two linked charts, one independent chart, and a
  dashboard for this table, then summarize the findings."

### Stage 9: CRDT and Sync Follow-Up

Add analysis document CRDT coverage and decide dashboard sync boundaries.

Likely changes:

- `packages/documents/src/crdt.ts`
- `packages/documents/__tests__/analysisCrdt.test.ts`
- `apps/sqlrooms-cli-ui/src/store.ts`
- Possibly a new Mosaic dashboard CRDT mirror if dashboard state must sync with
  document sync.

Acceptance criteria:

- Analysis artifact metadata and Tiptap JSON content sync through Loro
  snapshots.
- Standalone chart block config and `selectionGroupId` values sync as part of
  the analysis document content.
- Existing Markdown document CRDT behavior is unchanged.
- Embedded dashboard child artifact metadata is preserved.
- The feature has a documented answer for whether dashboard backing state is
  synced by this mirror or by app persistence only.

Checks:

- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/documents typecheck`

### Stage 10: Documentation, Example, and Polish

Document the public API and add a small usage example.

Likely changes:

- `packages/documents/README.md`
- `docs/packages.md`
- `apps/sqlrooms-cli-ui/README.md`
- Possibly `examples/analysis` if the feature should be shown outside the CLI UI.

Acceptance criteria:

- README explains `analysis` artifact registration and embed renderer setup.
- README explains standalone analysis chart blocks, chart selection groups, and
  how they differ from embedded dashboards.
- README documents analysis commands and AI instructions.
- Docs clarify the difference between Markdown `document`, `analysis`, and
  `dashboard`.
- A smoke path exists for manually creating an analysis with an embedded
  dashboard.

Checks:

- `pnpm build`
- `pnpm --filter @sqlrooms/documents test`
- `pnpm --filter @sqlrooms/documents typecheck`
- `pnpm lint`

## Files and Modules Likely to Change

- `packages/documents/src/AnalysisDocumentSliceConfig.ts`
- `packages/documents/src/AnalysisDocumentsSlice.ts`
- `packages/documents/src/AnalysisDocument.tsx`
- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentEditorRoot.tsx`
- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentEditorContent.tsx`
- `packages/documents/src/AnalysisDocumentEditor/AnalysisDocumentToolbar.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisChartNode.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisArtifactEmbedNode.tsx`
- `packages/documents/src/AnalysisDocumentEditor/extensions/AnalysisImageNode.tsx`
- `packages/documents/src/AnalysisDocumentEditor/node-views/AnalysisChartNodeView.tsx`
- `packages/documents/src/AnalysisDocumentEditor/node-views/AnalysisArtifactEmbedNodeView.tsx`
- `packages/documents/src/AnalysisChartRendererContext.tsx`
- `packages/documents/src/AnalysisEmbedRendererContext.tsx`
- `packages/documents/src/analysisCommands.ts`
- `packages/documents/src/analysisAi.ts`
- `packages/documents/src/crdt.ts`
- `packages/documents/src/index.ts`
- `packages/documents/README.md`
- `packages/documents/__tests__/*`
- `packages/artifacts/src/ArtifactsSliceConfig.ts`
- `packages/artifacts/src/ArtifactsSlice.ts`
- `packages/artifacts/src/artifactTabs.tsx`
- `packages/artifacts/__tests__/*`
- `packages/artifacts/README.md`
- `packages/mosaic/src/chart/MosaicChartView.tsx`
- `packages/mosaic/src/chart/useMosaicChartSelectionParams.ts`
- `packages/mosaic/src/chart/MosaicDashboardChart.tsx`
- `packages/mosaic/src/chart/MosaicDashboardChartContent.tsx`
- `packages/mosaic/src/index.ts`
- `apps/sqlrooms-cli-ui/src/artifactTypes.tsx`
- `apps/sqlrooms-cli-ui/src/store-types.ts`
- `apps/sqlrooms-cli-ui/src/store.ts`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisArtifact.tsx`
- `apps/sqlrooms-cli-ui/src/workspace/AnalysisChartRenderer.tsx`
- `apps/sqlrooms-cli-ui/src/createArtifactContextAiTools.ts`
- `apps/sqlrooms-cli-ui/src/createAnalysisAgent.ts`
- `docs/packages.md`

## Risks and Open Questions

- Should embedded dashboards be hidden artifacts in the global artifact registry,
  or should analysis documents own dashboard-like child state directly? The
  recommended path is hidden artifacts because it reuses lifecycle, dashboard
  tools, and runtime cleanup.
- Should deleting an analysis cascade-delete embedded dashboard artifacts? The
  likely default should be yes for artifacts with `parentArtifactId` equal to
  the analysis id and `visibility: 'embedded'`, but this needs an explicit
  policy and tests.
- Should users be able to promote an embedded dashboard to a top-level
  dashboard artifact? This is useful, but can wait until after v1.
- Should chart blocks be static image assets, live Vega specs, or embedded
  dashboard panels? For v1, prefer live standalone Mosaic/vgplot chart blocks
  for focused charts, image/chart asset blocks for static output, and dashboard
  embeds for multi-panel interactive analysis.
- Should standalone chart crossfilter groups be explicit user-facing groups or
  inferred from adjacency/section? Prefer explicit `selectionGroupId` in state;
  the UI can later offer friendlier grouping controls.
- How much editing should v1 support manually? A simple block list editor is
  lower risk than a full drag-and-drop block editor.
- Do analysis blocks need nested blocks immediately? Probably not. Add
  `children` only after flat blocks are stable.
- How should CRDT sync compose with dashboard persistence? Existing document
  CRDT sync does not sync Mosaic dashboard state.
- Should `analysis` live in `@sqlrooms/documents` or a new
  `@sqlrooms/analysis` package? Start in `@sqlrooms/documents` because it owns
  document/editor/asset concerns; split later if dependencies grow.
- Can `ArtifactMetadata` accept optional fields without breaking persisted
  rooms? Zod defaults should preserve backward compatibility, but old clients
  may drop unknown fields if they parse and rewrite config.

## Progress Log

- 2026-05-28: Plan created after repository inspection. No implementation code
  changed.
