---
outline: deep
---

# Blocks and Block Documents

Blocks are composable units of workspace content or behavior. Block documents
are ordered, rich-text containers that mix ordinary content with interactive
SQLRooms features such as charts, pivots, and dashboards.

Use the layers according to the job they own:

| Layer          | Responsibility                                                          | Package               |
| -------------- | ----------------------------------------------------------------------- | --------------------- |
| Artifact       | Top-level workspace identity, title, selection, and navigation          | `@sqlrooms/artifacts` |
| Block contract | Portable identity, attributes, references, and ownership                | `@sqlrooms/blocks`    |
| Feature state  | Queries, dashboards, pivots, maps, or other interactive state           | The feature package   |
| Block document | Ordered Tiptap content, editor UI, mutations, commands, and AI adapters | `@sqlrooms/documents` |

A block document is usually itself a top-level artifact. Its embedded stateful
blocks are not child artifacts: they refer directly to feature-owned state.

## Block kinds

`@sqlrooms/documents` supports text and interactive block DTOs that map to its
canonical Tiptap/ProseMirror JSON:

- headings, paragraphs, lists, and todos
- images and chart images backed by document assets
- standalone `chart` blocks for a focused chart bound to a table
- `statefulBlock` blocks for feature-owned surfaces such as a dashboard or
  pivot table

Use a standalone chart for one visualization with document-local context. Use
a stateful block when the feature has its own substantial configuration,
runtime, or lifecycle.

## Set up a block document artifact

Compose both artifact and block-document state, and persist both configs:

```tsx
import {
  ArtifactTabs,
  ArtifactsSliceConfig,
  createArtifactPanelDefinition,
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactTypeDefinition,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {
  BlockDocumentArtifact,
  BlockDocumentStatefulBlockRendererProvider,
  BlockDocumentsSliceConfig,
  createBlockDocumentFeatureSlices,
  type BlockDocumentFeatureSlicesState,
  type BlockDocumentStatefulBlockRenderer,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {
  PivotSliceConfig,
  PivotBlock,
  createPivotSlice,
  type PivotSliceState,
} from '@sqlrooms/pivot';
import {
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';

type RoomState = RoomShellSliceState &
  ArtifactsSliceState &
  BlockDocumentFeatureSlicesState &
  PivotSliceState;

const PivotBlockRenderer: BlockDocumentStatefulBlockRenderer = ({
  blockInstanceId,
  readOnly,
}) => (
  <PivotBlock
    blockId={blockInstanceId}
    blockType="pivot"
    pivotId={blockInstanceId}
    readOnly={readOnly}
  />
);

const pivotBlockTypes = [
  {
    blockType: 'pivot',
    label: 'Pivot table',
    description: 'Explore a table by dimensions and measures',
    createNode: (blockId: string) => ({
      type: 'blockDocumentStatefulBlock',
      attrs: {
        id: blockId,
        blockType: 'pivot',
        blockInstanceId: blockId,
        ownership: 'owned',
        caption: '',
      },
    }),
  },
];

const BlockDocumentPanel: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId =
    typeof meta?.artifactId === 'string' ? meta.artifactId : panelId;
  const artifact = useRoomStore((state) =>
    artifactId ? state.artifacts.getArtifact(artifactId) : undefined,
  );
  const renameArtifact = useRoomStore(
    (state) => state.artifacts.renameArtifact,
  );

  if (!artifactId || !artifact) return null;

  return (
    <BlockDocumentStatefulBlockRendererProvider
      renderers={{pivot: PivotBlockRenderer}}
      blockTypes={pivotBlockTypes}
    >
      <BlockDocumentArtifact
        artifactId={artifactId}
        title={artifact.title}
        onTitleChange={(title) => renameArtifact(artifactId, title)}
      />
    </BlockDocumentStatefulBlockRendererProvider>
  );
};

const DocumentWorkspacePanel: RoomPanelComponent = () => (
  <ArtifactTabs types={['block-document']} panelKey="artifact">
    <ArtifactTabs.SearchDropdown />
    <ArtifactTabs.Tabs />
    <ArtifactTabs.NewButton artifactType="block-document" />
  </ArtifactTabs>
);

const artifactTypes = defineArtifactTypes({
  'block-document': {
    label: 'Document',
    defaultTitle: 'Untitled document',
    component: BlockDocumentPanel,
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
} satisfies Record<'block-document', ArtifactTypeDefinition<RoomState>>);

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'my-workspace',
      sliceConfigSchemas: {
        artifacts: ArtifactsSliceConfig,
        blockDocuments: BlockDocumentsSliceConfig,
        pivot: PivotSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice({
        layout: {
          config: {
            id: 'workspace',
            type: 'tabs',
            panel: 'workspace',
            children: [],
            activeTabIndex: 0,
          },
          panels: {
            workspace: {
              title: 'Documents',
              component: DocumentWorkspacePanel,
            },
            artifact: createArtifactPanelDefinition(artifactTypes, store),
          },
        },
      })(set, get, store),
      ...createArtifactsSlice({artifactTypes})(set, get, store),
      ...createBlockDocumentFeatureSlices<RoomState>({
        onCreateOwnedStatefulBlock: ({
          blockType,
          blockInstanceId,
          getState,
        }) => {
          if (blockType === 'pivot') {
            getState().pivot.ensurePivot(blockInstanceId);
          }
        },
        onDeleteOwnedStatefulBlock: ({
          blockType,
          blockInstanceId,
          getState,
        }) => {
          if (blockType === 'pivot') {
            getState().pivot.removePivot(blockInstanceId);
          }
        },
      })(set, get, store),
      ...createPivotSlice()(set, get, store),
    }),
  ),
);
```

The artifact panel wrapper resolves the artifact metadata and keeps the title
in sync with the editor.

`createBlockDocumentFeatureSlices()` combines document content with the shared
block-settings slice. If another composed feature already installs block
settings, use `createBlockDocumentsSlice()` directly so the shared slice is
installed only once.

## Mutate documents through block DTOs

The slice exposes a small set of ordered mutations. These are the same
primitives used by the editor, commands, and generic AI adapters:

```ts
const {blockDocuments} = roomStore.getState();

blockDocuments.appendBlocks(documentId, [
  {
    id: 'summary',
    type: 'heading',
    level: 2,
    text: [{type: 'text', text: 'Summary'}],
  },
  {
    id: 'conclusion',
    type: 'paragraph',
    text: [
      {
        type: 'text',
        text: 'Revenue increased during the selected period.',
      },
    ],
  },
]);

blockDocuments.moveBlock(documentId, 'conclusion', 0);
blockDocuments.removeBlock(documentId, 'summary');
```

Use `setContent()` when synchronizing a complete Tiptap document. Prefer the
block DTO operations for commands and agent tools because they are smaller,
easier to validate, and preserve the same visible mutation path as the UI.

## Host stateful blocks

A stateful block reference identifies the feature state without copying that
state into the document:

```ts
blockDocuments.appendBlocks(documentId, [
  {
    id: 'sales-pivot-block',
    type: 'statefulBlock',
    blockType: 'pivot',
    blockInstanceId: 'sales-pivot',
    ownership: 'owned',
    caption: 'Sales by region',
  },
]);
```

Register renderers at the document surface:

```tsx
<BlockDocumentStatefulBlockRendererProvider
  renderers={{pivot: PivotBlockRenderer}}
  blockTypes={pivotBlockTypes}
>
  <BlockDocumentArtifact artifactId={documentId} />
</BlockDocumentStatefulBlockRendererProvider>
```

If a renderer is unavailable, the document preserves the block JSON and shows
an unsupported state. This lets workspaces round-trip content even when a host
does not enable every feature.

## Choose an ownership mode

Ownership controls lifecycle, not visual nesting:

| Ownership  | Meaning                                                        | Delete behavior                                                |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `owned`    | The backing instance belongs to this document                  | Remove backing state after its last owned reference disappears |
| `shared`   | The document refers to state shared elsewhere in the workspace | Keep backing state                                             |
| `external` | The reference resolves outside the document's managed state    | Keep backing state                                             |

Wire lifecycle callbacks when composing the slice. The complete setup above
installs them like this:

```ts
...createBlockDocumentFeatureSlices<RoomState>({
  onCreateOwnedStatefulBlock: ({blockType, blockInstanceId, getState}) => {
    if (blockType === 'pivot') {
      getState().pivot.ensurePivot(blockInstanceId);
    }
  },
  onDeleteOwnedStatefulBlock: ({blockType, blockInstanceId, getState}) => {
    if (blockType === 'pivot') {
      getState().pivot.removePivot(blockInstanceId);
    }
  },
})(set, get, store),
```

Captions belong to the document reference. A feature's own display name belongs
to its backing instance and should be changed through that feature's UI or
commands.

## Commands, AI, and collaboration

`createBlockDocumentCommands()` exposes validated append, move, update, and
remove operations for palettes and other command surfaces. AI integrations can
use `createBlockDocumentCommandAiAdapter()` so tools invoke those same commands
instead of maintaining a separate mutation path.

For collaborative workspaces, `createDocumentsCrdtMirror()` from
`@sqlrooms/documents/crdt` mirrors document configs to Loro. The room store
remains the application-facing state model; the mirror handles synchronization
and loop prevention.

See the [`@sqlrooms/blocks` API reference](/api/blocks/), the
[`@sqlrooms/documents` API reference](/api/documents/), and
[Artifacts](/artifacts) for the top-level workspace model. See
[Commands](/commands) for exposing the same document mutations to palettes,
agents, and external integrations.
