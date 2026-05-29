Artifact-scoped Markdown documents, structured blocks documents, and
knowledge-index utilities for SQLRooms.

## Usage

```tsx
import {
  DOCUMENT_AI_INSTRUCTIONS,
  BlocksDocumentArtifact,
  BlocksDocumentsSliceConfig,
  BlocksDocumentChartRendererProvider,
  BlocksDocumentStatefulBlockRendererProvider,
  DocumentsSliceConfig,
  buildKnowledgeIndex,
  createBlocksDocumentCommands,
  createBlocksDocumentAiInstructions,
  createBlocksDocumentAuthoringInstructions,
  createBlocksDocumentsSlice,
  createDocumentCommands,
  createDocumentsSlice,
  createMarkdownDocumentBlockDefinition,
} from '@sqlrooms/documents';
import {createDocumentsCrdtMirror} from '@sqlrooms/documents/crdt';
import {
  createArtifactTypeFromStatefulBlock,
  defineArtifactTypes,
} from '@sqlrooms/artifacts';

const documentBlockDefinition = createMarkdownDocumentBlockDefinition();

const artifactTypes = defineArtifactTypes({
  document: createArtifactTypeFromStatefulBlock(documentBlockDefinition),
  'blocks-document': {
    label: 'Blocks Document',
    defaultTitle: 'Blocks Document',
    component: BlocksDocumentArtifact,
    onCreate: ({artifactId, store}) => {
      store.getState().blocksDocuments.ensureBlocksDocument(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().blocksDocuments.ensureBlocksDocument(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().blocksDocuments.removeBlocksDocument(artifactId);
    },
  },
});

const roomStore = createRoomStore(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        documents: DocumentsSliceConfig,
        blocksDocuments: BlocksDocumentsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createDocumentsSlice()(set, get, store),
      ...createBlocksDocumentsSlice({
        onDeleteOwnedStatefulBlock: ({
          blockType,
          blockInstanceId,
          getState,
        }) => {
          if (blockType === 'dashboard') {
            getState().mosaicDashboard.removeDashboard(blockInstanceId);
          }
        },
      })(set, get, store),
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

## Blocks Documents

`createBlocksDocumentsSlice()` exposes structured state for artifact types
backed by composable blocks: rich text, lists, images, standalone Mosaic/vgplot
charts, and direct stateful blocks such as dashboards, pivots, or Markdown
documents.

Blocks documents persist Tiptap/ProseMirror JSON as their canonical content
and provide block DTO helpers for command and AI authoring surfaces:

```tsx
import {
  BlocksDocumentsSliceConfig,
  createBlocksDocumentsSlice,
} from '@sqlrooms/documents';

const roomStore = createRoomStore(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        blocksDocuments: BlocksDocumentsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createBlocksDocumentsSlice()(set, get, store),
    }),
  ),
);
```

The slice can create blocks documents, replace the Tiptap JSON body, and
append/insert/update/remove/reorder top-level blocks. Supported block DTOs
include headings, paragraphs, rich text, lists, todos, images, chart images,
standalone chart blocks, and direct stateful blocks.

`BlocksDocumentArtifact` and `BlocksDocumentEditor` provide the first rich
editor surface for this structured state. The editor owns Tiptap nodes for
SQLRooms custom blocks, but chart and stateful block rendering are
host-provided so `@sqlrooms/documents` does not import Mosaic, pivot, or other
feature packages:

```tsx
<BlocksDocumentChartRendererProvider
  renderer={MosaicBlocksDocumentChartRenderer}
>
  <BlocksDocumentStatefulBlockRendererProvider
    renderers={{
      dashboard: DashboardBlockRenderer,
      pivot: PivotBlockRenderer,
    }}
    blockTypes={[
      {
        blockType: 'dashboard',
        label: 'Dashboard',
        description: 'Interactive dashboard',
        createNode: (blockId) => ({
          type: 'blocksDocumentStatefulBlock',
          attrs: {
            id: blockId,
            blockType: 'dashboard',
            blockInstanceId: createDashboardBlockState(blockId),
            ownership: 'owned',
            title: 'Dashboard',
            caption: '',
          },
        }),
      },
    ]}
  >
    <BlocksDocumentArtifact artifactId={blocksDocumentArtifactId} />
  </BlocksDocumentStatefulBlockRendererProvider>
</BlocksDocumentChartRendererProvider>
```

If no renderer is registered, chart and stateful blocks render a clear
unsupported state while preserving their Tiptap JSON attributes. `blockTypes`
controls the host-specific entries shown in the plus menu.

### Stateful Blocks

Use a `statefulBlock` block when the document should host a stateful SQLRooms
surface directly, without wrapping it in an artifact shell:

```ts
blocksDocuments.appendBlocks(blocksDocumentArtifactId, [
  {
    id: 'pivot-block',
    type: 'statefulBlock',
    blockType: 'pivot',
    blockInstanceId: 'pivot-instance-1',
    ownership: 'owned',
    title: 'Embedded Pivot Table',
  },
]);
```

Hosts provide renderers through `BlocksDocumentStatefulBlockRendererProvider`:

```tsx
<BlocksDocumentStatefulBlockRendererProvider
  renderers={{
    pivot: PivotBlockRenderer,
    dashboard: DashboardBlockRenderer,
  }}
  blockTypes={[
    {
      blockType: 'pivot',
      label: 'Pivot Table',
      description: 'Embedded pivot table',
    },
  ]}
>
  <BlocksDocumentArtifact artifactId={blocksDocumentArtifactId} />
</BlocksDocumentStatefulBlockRendererProvider>
```

Top-level artifacts should wrap stateful blocks or block containers at the
workspace/tab layer. Blocks documents host the stateful block directly instead
of embedding an artifact shell.

Owned stateful blocks are lifecycle-managed by the host app. Pass
`onDeleteOwnedStatefulBlock` to `createBlocksDocumentsSlice()` to clean up
feature state when an owned block is removed from a document or when its owning
blocks document is deleted. Blocks with `ownership: 'shared'` or
`ownership: 'external'` are not cleaned up by the documents slice.
Hosts can also pass `onRenameOwnedStatefulBlock` to synchronize block `title`
changes into the backing feature state. Captions stay local to the blocks
document.

### Standalone Chart Blocks

Standalone `chart` blocks are meant for focused, in-document charts. They store
the target `tableName`, a Mosaic `ChartConfig`, an optional caption, and an
optional `selectionGroupId`:

```ts
blocksDocuments.appendBlocks(blocksDocumentArtifactId, [
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
dashboard. Charts with the same `selectionGroupId` in one blocks document share
a crossfilter selection. Charts without a group get independent
document/block-scoped selections.

### Hosted Dashboards

Use a `statefulBlock` block when the document needs a multi-panel interactive
dashboard. The block instance id should map to dashboard state in the host app's
Mosaic slice, while the top-level artifact shell remains optional for workspace
navigation.

Standalone chart blocks are best for one chart with local context. Dashboard
stateful blocks are best for coordinated multi-panel views, richer dashboard
layout, or when dashboard AI tools are the natural authoring path.

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

`createBlocksDocumentCommands()` registers commands for structured blocks
document artifacts. By default the command IDs are:

- `blocks-document.list`
- `blocks-document.get`
- `blocks-document.create`
- `blocks-document.append-blocks`
- `blocks-document.insert-blocks`
- `blocks-document.update-block`
- `blocks-document.remove-block`
- `blocks-document.move-block`
- `blocks-document.create-chart-block`
- `blocks-document.create-stateful-block`

Hosts can pass `artifactType`, `artifactLabel`, and `commandNamespace` options
to expose the same command surface under product-specific names while keeping
the package API generic. Register these commands alongside
`createBlocksDocumentAiInstructions()` when exposing blocks document artifacts
to an assistant.

Hosts can pass `statefulBlockTypes` to expose supported feature-backed block
types to `blocks-document.create-stateful-block`.

`createBlocksDocumentAuthoringInstructions()` adds a higher-level authoring
contract for assistants or host-provided sub-agents. It names the configured
command set, explains when to use standalone chart blocks versus host-provided
stateful blocks, and keeps selection-group behavior explicit.

## CRDT

`@sqlrooms/documents/crdt` exposes Loro Mirror bindings for document state:

```ts
createCrdtSlice({
  mirrors: {
    documentState: createDocumentsCrdtMirror(),
  },
});
```

`createDocumentsCrdtMirror()` syncs Markdown document bodies, blocks document
Tiptap JSON content, document-owned assets, standalone chart block configs,
blocks document/document artifact metadata, and document artifact tab order.
The current artifact selection is kept local.

By default, the mirror treats `blocks-document` artifacts as blocks documents.
Hosts with their own artifact type names can pass
`blocksDocumentArtifactTypes`, for example:

```ts
createDocumentsCrdtMirror({
  blocksDocumentArtifactTypes: ['report'],
});
```

Hosted dashboard state should continue to use the host app's Mosaic persistence,
or a future Mosaic-specific CRDT mirror.

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
