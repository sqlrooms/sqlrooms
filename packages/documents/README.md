Artifact-scoped Markdown documents, structured block documents, and
knowledge-index utilities for SQLRooms.

## Usage

```tsx
import {
  DOCUMENT_AI_INSTRUCTIONS,
  BlockDocumentArtifact,
  BlockDocumentsSliceConfig,
  BlockDocumentChartRendererProvider,
  BlockDocumentStatefulBlockRendererProvider,
  DocumentsSliceConfig,
  buildKnowledgeIndex,
  createBlockDocumentCommands,
  createBlockDocumentAiInstructions,
  createBlockDocumentAuthoringInstructions,
  createBlockDocumentsSlice,
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
  'block-document': {
    label: 'Block Document',
    defaultTitle: 'Block Document',
    component: BlockDocumentArtifact,
    onCreate: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().blockDocuments.removeBlockDocument(artifactId);
    },
  },
});

const roomStore = createRoomStore(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        documents: DocumentsSliceConfig,
        blockDocuments: BlockDocumentsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createDocumentsSlice()(set, get, store),
      ...createBlockDocumentsSlice({
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

## Block Documents

`createBlockDocumentsSlice()` exposes structured state for artifact types
backed by composable blocks: rich text, lists, images, standalone Mosaic/vgplot
charts, and direct stateful blocks such as dashboards, pivots, or Markdown
documents.

Block documents persist Tiptap/ProseMirror JSON as their canonical content
and provide block DTO helpers for command and AI authoring surfaces:

```tsx
import {
  BlockDocumentsSliceConfig,
  createBlockDocumentsSlice,
} from '@sqlrooms/documents';

const roomStore = createRoomStore(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        blockDocuments: BlockDocumentsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createBlockDocumentsSlice()(set, get, store),
    }),
  ),
);
```

The slice can create block documents, replace the Tiptap JSON body, and
append/insert/update/remove/reorder top-level blocks. Supported block DTOs
include headings, paragraphs, rich text, lists, todos, images, chart images,
standalone chart blocks, and direct stateful blocks.

`BlockDocumentArtifact` and `BlockDocumentEditor` provide the first rich
editor surface for this structured state. `BlockDocumentArtifact` injects an
editable, non-movable title node into the Tiptap document and reports title
changes through `onTitleChange`, so hosts can keep artifact metadata and tab
labels in sync. The editor owns Tiptap nodes for SQLRooms custom blocks, but
chart and stateful block rendering are host-provided so `@sqlrooms/documents`
does not import Mosaic, pivot, or other feature packages:

```tsx
<BlockDocumentChartRendererProvider renderer={MosaicBlockDocumentChartRenderer}>
  <BlockDocumentStatefulBlockRendererProvider
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
          type: 'blockDocumentStatefulBlock',
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
    <BlockDocumentArtifact
      artifactId={blockDocumentArtifactId}
      title="Analysis"
      onTitleChange={(title) => renameBlockDocument(blockDocumentArtifactId, title)}
    />
  </BlockDocumentStatefulBlockRendererProvider>
</BlockDocumentChartRendererProvider>
```

If no renderer is registered, chart and stateful blocks render a clear
unsupported state while preserving their Tiptap JSON attributes. `blockTypes`
controls the host-specific entries shown in the plus menu.
When a block is converted through the handle menu, custom `createNode`
callbacks receive an optional `{initialText}` value with the source block text;
hosts can use it to seed stateful blocks such as embedded Markdown documents.
Stateful block types can opt into persisted vertical resizing with
`resizableHeight`, `defaultHeight`, `minHeight`, and `maxHeight`; the editor
stores the resulting `height` on the block node and renders a bottom resize
handle for writable documents.

### Stateful Blocks

Use a `statefulBlock` block when the document should host a stateful SQLRooms
surface directly, without wrapping it in an artifact shell:

```ts
blockDocuments.appendBlocks(blockDocumentArtifactId, [
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

Hosts provide renderers through `BlockDocumentStatefulBlockRendererProvider`:

```tsx
<BlockDocumentStatefulBlockRendererProvider
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
  <BlockDocumentArtifact
    artifactId={blockDocumentArtifactId}
    title="Embedded Report"
    onTitleChange={(title) => renameBlockDocument(blockDocumentArtifactId, title)}
  />
</BlockDocumentStatefulBlockRendererProvider>
```

Top-level artifacts should wrap stateful blocks or block containers at the
workspace/tab layer. Block documents host the stateful block directly instead
of embedding an artifact shell.

Owned stateful blocks are lifecycle-managed by the host app. Pass
`onCreateOwnedStatefulBlock` to initialize feature state when a new owned block
reference appears, and `onDeleteOwnedStatefulBlock` to clean it up when an owned
block is removed from a document or when its owning block document is deleted.
Blocks with `ownership: 'shared'` or `ownership: 'external'` are not cleaned up
by the documents slice.
Hosts can also pass `onRenameOwnedStatefulBlock` to synchronize block `title`
changes into the backing feature state. Captions stay local to the blocks
document.

The editor normalizes pasted or duplicated owned stateful blocks by assigning
fresh top-level block IDs and fresh `blockInstanceId` values when a duplicate
owned instance would otherwise point at the same backing state.

### Standalone Chart Blocks

Standalone `chart` blocks are meant for focused, in-document charts. They store
the target `tableName`, a Mosaic `ChartConfig`, an optional caption, and an
optional `selectionGroupId`:

```ts
blockDocuments.appendBlocks(blockDocumentArtifactId, [
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
dashboard. Charts with the same `selectionGroupId` in one block document share
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

`createBlockDocumentCommands()` registers commands for structured blocks
document artifacts. By default the command IDs are:

- `block-document.list`
- `block-document.get`
- `block-document.create`
- `block-document.append-blocks`
- `block-document.insert-blocks`
- `block-document.update-block`
- `block-document.remove-block`
- `block-document.move-block`
- `block-document.create-chart-block`
- `block-document.create-stateful-block`

Hosts can pass `artifactType`, `artifactLabel`, and `commandNamespace` options
to expose the same command surface under product-specific names while keeping
the package API generic. Register these commands alongside
`createBlockDocumentAiInstructions()` when exposing block document artifacts
to an assistant.

Hosts can pass `statefulBlockTypes` to expose supported feature-backed block
types to `block-document.create-stateful-block`.

`createBlockDocumentAuthoringInstructions()` adds a higher-level authoring
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

`createDocumentsCrdtMirror()` syncs Markdown document bodies, block document
Tiptap JSON content, document-owned assets, standalone chart block configs,
block document/document artifact metadata, and document artifact tab order.
The current artifact selection is kept local.

By default, the mirror treats `block-document` artifacts as block documents.
Hosts with their own artifact type names can pass
`blockDocumentArtifactTypes`, for example:

```ts
createDocumentsCrdtMirror({
  blockDocumentArtifactTypes: ['report'],
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
