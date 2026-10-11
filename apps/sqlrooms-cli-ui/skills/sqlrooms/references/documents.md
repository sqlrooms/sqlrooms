# Documents

`block-document.list` locates documents and their artifact IDs.
`block-document.get` reads one document with an explicit `artifactId`.
`block-document.create-artifact` creates and selects a document; retain its returned ID.

Blocks are ordered and have stable IDs. `block-document.update-block` replaces
one block; obtain its existing representation first, retain its ID, type, and
unmodified fields. `block-document.append-blocks` adds new blocks; each needs a new document-unique
`id`. Inspect the schemas: text paragraphs use inline text nodes, for example
`{"id":"note-1","type":"paragraph","text":[{"type":"text","text":"A note"}]}`.

Use `block-document.inspect-block({artifactId, blockId})` to read one block.
Inline blocks carry their configuration in `block`; stateful blocks additionally
return `backingState` through their registered type reader. Unsupported readers
and missing resources fail explicitly.

Owned stateful blocks reference a resource through `blockInstanceId`. Do not
replace a map block to edit a neighboring chart. Read back after mutations.
