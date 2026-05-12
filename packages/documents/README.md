Artifact-scoped Markdown documents and knowledge-index utilities for SQLRooms.

## Usage

```tsx
import {
  DOCUMENT_AI_INSTRUCTIONS,
  DocumentsSliceConfig,
  MarkdownDocument,
  buildKnowledgeIndex,
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

`MarkdownDocument` uses the Tiptap-backed `MarkdownDocumentEditor`. It keeps
Markdown as the controlled value, renders a rich document editing surface, and
keeps the existing CodeMirror source panel for direct Markdown edits.

`MarkdownDocumentEditor` is also exported as a reusable controlled editor:

```tsx
<MarkdownDocumentEditor value={markdown} onChange={setMarkdown} />
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

## CRDT

`@sqlrooms/documents/crdt` exposes Loro Mirror bindings for document state:

```ts
createCrdtSlice({
  mirrors: {
    documentState: createDocumentsCrdtMirror(),
  },
});
```

`createDocumentsCrdtMirror()` syncs Markdown document bodies plus document
artifact metadata so remote documents can appear in artifact tabs. The current
artifact selection is kept local.

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
