Artifact-scoped Markdown documents, structured Analysis artifacts, and
knowledge-index utilities for SQLRooms.

## Usage

```tsx
import {
  DOCUMENT_AI_INSTRUCTIONS,
  ANALYSIS_AI_INSTRUCTIONS,
  AnalysisDocumentArtifact,
  AnalysisDocumentsSliceConfig,
  AnalysisChartRendererProvider,
  AnalysisEmbedRendererProvider,
  DocumentsSliceConfig,
  MarkdownDocument,
  buildKnowledgeIndex,
  createAnalysisCommands,
  createAnalysisAuthoringInstructions,
  createAnalysisDocumentsSlice,
  createDocumentCommands,
  createDocumentsSlice,
} from '@sqlrooms/documents';
import {createDocumentsCrdtMirror} from '@sqlrooms/documents/crdt';
import {defineArtifactTypes} from '@sqlrooms/artifacts';

const artifactTypes = defineArtifactTypes({
  document: {
    label: 'Document',
    defaultTitle: 'Document',
    component: MarkdownDocument,
    onCreate: ({artifactId, store}) => {
      store.getState().documents.ensureDocument(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().documents.ensureDocument(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().documents.removeDocument(artifactId);
    },
  },
  analysis: {
    label: 'Analysis',
    defaultTitle: 'Analysis',
    component: AnalysisDocumentArtifact,
    onCreate: ({artifactId, store}) => {
      store.getState().analysisDocuments.ensureAnalysis(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().analysisDocuments.ensureAnalysis(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().analysisDocuments.removeAnalysis(artifactId);
    },
  },
});

const roomStore = createRoomStore(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        documents: DocumentsSliceConfig,
        analysisDocuments: AnalysisDocumentsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createDocumentsSlice()(set, get, store),
      ...createAnalysisDocumentsSlice()(set, get, store),
    }),
  ),
);
```

`MarkdownDocument` uses the Tiptap-backed `MarkdownDocumentEditor`. It keeps
Markdown as the controlled value, renders a rich document editing surface, and
keeps the existing CodeMirror source panel for direct Markdown edits.

`MarkdownDocumentEditor` is also exported as a reusable controlled editor:

```tsx
<MarkdownDocumentEditor
  value={markdown}
  assets={assets}
  onChange={setMarkdown}
/>
```

The rich editor is the primary surface. The optional Markdown source panel can
be opened alongside it and edits the same canonical Markdown string:

```tsx
<MarkdownDocumentEditor
  value={markdown}
  onChange={setMarkdown}
  sourcePanelOpen={showSource}
  onSourcePanelOpenChange={setShowSource}
/>
```

Document Markdown can reference document-owned assets with `asset://` URLs:

```md
![Revenue by week](asset://chart-revenue-week)
```

Pass the document asset map to `MarkdownDocumentEditor` to render those links as
browser-loadable image data while preserving the canonical `asset://` link in
Markdown source. `MarkdownDocument` handles this automatically for artifacts
stored in the documents slice.

The documents slice exposes `upsertAsset`, `removeAsset`, and `getAsset` for
managing image assets alongside Markdown content. SVG assets may use `utf8` or
`base64` encoding; PNG assets must use `base64` encoding.

## Analysis Documents

`createAnalysisDocumentsSlice()` exposes structured state for the `analysis`
artifact type. Use Analysis artifacts for narrative analytical writeups made of
composable blocks: rich text, lists, images, standalone Mosaic/vgplot charts,
and embedded artifacts such as dashboards.

Analysis documents persist Tiptap/ProseMirror JSON as their canonical content
and provide block DTO helpers for command and AI authoring surfaces:

```tsx
import {
  AnalysisDocumentsSliceConfig,
  createAnalysisDocumentsSlice,
} from '@sqlrooms/documents';

const roomStore = createRoomStore(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        analysisDocuments: AnalysisDocumentsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createAnalysisDocumentsSlice()(set, get, store),
    }),
  ),
);
```

The slice can create analysis documents, replace the Tiptap JSON body, and
append/insert/update/remove/reorder top-level blocks. Supported block DTOs
include headings, paragraphs, rich text, lists, todos, images, chart images,
standalone chart blocks, and artifact embeds.

`AnalysisDocumentArtifact` and `AnalysisDocumentEditor` provide the first rich
editor surface for this structured state. The editor owns Tiptap nodes for
SQLRooms custom blocks, but chart rendering and artifact embeds are
host-provided so `@sqlrooms/documents` does not import Mosaic:

```tsx
<AnalysisChartRendererProvider renderer={MosaicAnalysisChartRenderer}>
  <AnalysisEmbedRendererProvider
    renderers={{
      dashboard: EmbeddedDashboardRenderer,
    }}
    artifactTypes={[
      {
        artifactType: 'dashboard',
        label: 'Dashboard',
        description: 'Embedded dashboard',
        createNode: (blockId) => ({
          type: 'analysisArtifactEmbed',
          attrs: {
            id: blockId,
            artifactId: createEmbeddedDashboardArtifact(),
            artifactType: 'dashboard',
            caption: '',
          },
        }),
      },
    ]}
  >
    <AnalysisDocumentArtifact artifactId={analysisArtifactId} />
  </AnalysisEmbedRendererProvider>
</AnalysisChartRendererProvider>
```

If no renderer is registered, chart and embed blocks render a clear unsupported
state while preserving their Tiptap JSON attributes. `artifactTypes` is optional;
when omitted, the editor derives plus-menu embed entries from the renderer keys
and inserts a block with only `artifactType` prefilled.

### Standalone Chart Blocks

Standalone `chart` blocks are meant for focused, in-document charts. They store
the target `tableName`, a Mosaic `ChartConfig`, an optional caption, and an
optional `selectionGroupId`:

```ts
analysisDocuments.appendBlocks(analysisArtifactId, [
  {
    id: 'revenue-histogram',
    type: 'chart',
    tableName: 'sales',
    config: {
      chartType: 'histogram',
      settings: {field: 'revenue'},
    },
    selectionGroupId: 'overview',
    caption: 'Revenue distribution',
  },
]);
```

Hosts can render these blocks with the same Mosaic/vgplot chart implementation
and settings UI used inside dashboard panels, without embedding a full
dashboard. Charts with the same `selectionGroupId` in one Analysis share a
crossfilter selection. Charts without a group get independent
analysis/block-scoped selections.

### Dashboard Embeds

Use an `artifactEmbed` block when the document needs a multi-panel interactive
dashboard:

```ts
analysisDocuments.appendBlocks(analysisArtifactId, [
  {
    id: 'regional-dashboard',
    type: 'artifactEmbed',
    artifactId: dashboardArtifactId,
    artifactType: 'dashboard',
    caption: 'Regional dashboard',
  },
]);
```

Embedded dashboards should be created as normal dashboard artifacts with
`visibility: 'embedded'` and `parentArtifactId` set to the owning Analysis id.
Each embedded dashboard keeps its own dashboard id, Mosaic runtime keys, and
selection name, so multiple dashboards inside one Analysis crossfilter
independently.

Standalone chart blocks are best for one chart with local context. Dashboard
embeds are best for coordinated multi-panel views, richer dashboard layout, or
when dashboard AI tools are the natural authoring path.

## Commands

`createDocumentCommands()` registers AI- and palette-friendly commands for
document artifacts:

- `document.list`
- `document.get`
- `document.create`
- `document.set-markdown`
- `document.append-markdown`

Register the commands with your room command slice and include
`DOCUMENT_AI_INSTRUCTIONS` in your AI system prompt when exposing
`list_commands` and `execute_command` tools.

`createAnalysisCommands()` registers commands for structured Analysis
artifacts:

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

Register these commands alongside `ANALYSIS_AI_INSTRUCTIONS` when exposing
Analysis artifacts to an assistant.

`createAnalysisAuthoringInstructions()` adds a higher-level authoring contract
for assistants or host-provided sub-agents. It names the analysis command set,
explains when to use standalone chart blocks versus dashboard embeds, and keeps
selection-group behavior explicit.

## CRDT

`@sqlrooms/documents/crdt` exposes Loro Mirror bindings for document state:

```ts
createCrdtSlice({
  mirrors: {
    documentState: createDocumentsCrdtMirror(),
  },
});
```

`createDocumentsCrdtMirror()` syncs Markdown document bodies, Analysis document
Tiptap JSON content, document-owned assets, standalone chart block configs,
Analysis/document artifact metadata, embedded child artifact metadata, and
document artifact tab order. The current artifact selection is kept local.

Embedded dashboard artifact metadata syncs through this mirror, but Mosaic
dashboard backing state does not. Dashboard state should continue to use the
host app's Mosaic persistence, or a future Mosaic-specific CRDT mirror.

## Knowledge Index

`buildKnowledgeIndex` is a pure derived index. It does not persist data.

```ts
const index = buildKnowledgeIndex({
  documents: roomStore.getState().documents.config,
  artifacts: roomStore.getState().artifacts.config,
});
```

It extracts `[[Document Title]]` wikilinks, body hashtags such as `#metrics`,
and optional frontmatter tags. Links are resolved against document artifact
titles. Missing or ambiguous titles are reported as unresolved links.
