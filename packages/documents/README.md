Artifact-scoped Markdown documents and knowledge-index utilities for SQLRooms.

## Usage

```tsx
import {
  DocumentsSliceConfig,
  MarkdownDocument,
  buildKnowledgeIndex,
  createDocumentsSlice,
} from '@sqlrooms/documents';
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
});

const roomStore = createRoomStore(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        documents: DocumentsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createDocumentsSlice()(set, get, store),
    }),
  ),
);
```

`MarkdownDocumentEditor` exposes a controlled rich/source Markdown editor:

```tsx
<MarkdownDocumentEditor value={markdown} onChange={setMarkdown} />
```

The source mode edits Markdown directly. The rich mode uses Tiptap and serializes
changes back to Markdown.

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
