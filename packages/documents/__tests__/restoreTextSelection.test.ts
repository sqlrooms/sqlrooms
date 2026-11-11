import {Schema, type Node as ProseMirrorNode} from '@tiptap/pm/model';
import {TextSelection} from '@tiptap/pm/state';
import {restoreTextSelection} from '../src/BlockDocumentEditor/restoreTextSelection';

const schema = new Schema({
  nodes: {
    doc: {content: 'block+'},
    title: {group: 'block', content: 'text*'},
    heading: {group: 'block', content: 'text*', attrs: {id: {default: null}}},
    paragraph: {
      group: 'block',
      content: 'text*',
      attrs: {id: {default: null}},
    },
    chart: {group: 'block', atom: true, attrs: {id: {default: null}}},
    bulletList: {
      group: 'block',
      content: 'listItem+',
      attrs: {id: {default: null}},
    },
    listItem: {content: 'paragraph+'},
    text: {},
  },
});

/** Build a top-level text block with the given type, id and text. */
function block(type: string, id: string | null, text = '') {
  return schema.node(type, {id}, text ? schema.text(text) : undefined);
}

/** Wrap top-level blocks in a document node. */
function doc(...blocks: ProseMirrorNode[]) {
  return schema.node('doc', null, blocks);
}

/** Build a top-level bullet list with one editable paragraph. */
function listBlock(id: string, text: string) {
  return schema.node('bulletList', {id}, [
    schema.node('listItem', null, [
      schema.node('paragraph', null, schema.text(text)),
    ]),
  ]);
}

/** Position just inside the start of the top-level block with this ID. */
function startOf(node: ProseMirrorNode, id: string) {
  let pos = -1;
  node.forEach((child, offset) => {
    if (child.attrs.id === id) pos = offset + 1;
  });
  return pos;
}

describe('restoreTextSelection', () => {
  it('keeps the caret in its block when a block is inserted before it', () => {
    const before = doc(
      block('title', null, 'Title'),
      block('heading', 'heading', 'Overview'),
      block('paragraph', 'trailing'),
    );
    const caret = startOf(before, 'trailing');
    const selection = TextSelection.create(before, caret);

    const after = doc(
      block('title', null, 'Title'),
      block('heading', 'heading', 'Overview'),
      block('paragraph', 'appended', 'First note'),
      block('paragraph', 'trailing'),
    );
    const restored = restoreTextSelection(selection, after);

    expect(restored.from).toBe(startOf(after, 'trailing'));
    expect(restored.$from.parent.attrs.id).toBe('trailing');
  });

  it('keeps the offset within the block', () => {
    const before = doc(
      block('title', null, 'Title'),
      block('paragraph', 'note', 'Hello'),
    );
    const selection = TextSelection.create(
      before,
      startOf(before, 'note') + 2,
      startOf(before, 'note') + 4,
    );

    const after = doc(
      block('title', null, 'Title'),
      block('heading', 'new', 'Inserted'),
      block('paragraph', 'note', 'Hello'),
    );
    const restored = restoreTextSelection(selection, after);

    expect(restored.from).toBe(startOf(after, 'note') + 2);
    expect(restored.to).toBe(startOf(after, 'note') + 4);
  });

  it('shifts each endpoint by the block it belongs to', () => {
    // A selection from A into B. Reordering moves A (and the prefix block) but
    // leaves B where it was, so B's endpoint must not take A's negative shift.
    const before = doc(
      block('paragraph', 'prefix', 'P'),
      block('paragraph', 'a', 'AAAA'),
      block('paragraph', 'b', 'BBBB'),
    );
    const selection = TextSelection.create(
      before,
      startOf(before, 'a') + 2,
      startOf(before, 'b') + 2,
    );

    const after = doc(
      block('paragraph', 'a', 'AAAA'),
      block('paragraph', 'prefix', 'P'),
      block('paragraph', 'b', 'BBBB'),
    );
    const restored = restoreTextSelection(selection, after);

    expect(restored.from).toBe(startOf(after, 'a') + 2);
    expect(restored.to).toBe(startOf(after, 'b') + 2);
    expect(restored.$from.parent.attrs.id).toBe('a');
    expect(restored.$to.parent.attrs.id).toBe('b');
  });

  it('keeps an endpoint inside a block that got shorter', () => {
    const before = doc(
      block('paragraph', 'a', 'Hello world'),
      block('paragraph', 'b', 'BBBB'),
    );
    const selection = TextSelection.create(
      before,
      startOf(before, 'a') + 8,
      startOf(before, 'a') + 10,
    );

    const after = doc(
      block('paragraph', 'a', 'Hi'),
      block('paragraph', 'b', 'BBBB'),
    );
    const restored = restoreTextSelection(selection, after);

    // 'Hi' has two text positions after its start; both old offsets clamp to
    // the end of the block instead of spilling into 'b'.
    const blockEnd = startOf(after, 'a') + 2;
    expect(restored.from).toBe(blockEnd);
    expect(restored.to).toBe(blockEnd);
    expect(restored.$from.parent.attrs.id).toBe('a');
    expect(restored.$to.parent.attrs.id).toBe('a');
  });

  it('collapses instead of selecting between crossed endpoints', () => {
    const before = doc(
      block('paragraph', 'a', 'AAAA'),
      block('paragraph', 'b', 'BBBB'),
      block('paragraph', 'c', 'CCCC'),
    );
    const selection = TextSelection.create(
      before,
      startOf(before, 'a') + 2,
      startOf(before, 'b') + 2,
    );

    // Moving A behind C crosses the mapped endpoints: A's is now after B's.
    const after = doc(
      block('paragraph', 'b', 'BBBB'),
      block('paragraph', 'c', 'CCCC'),
      block('paragraph', 'a', 'AAAA'),
    );
    const restored = restoreTextSelection(selection, after);

    expect(restored.empty).toBe(true);
    expect(restored.from).toBe(startOf(after, 'b') + 2);
    expect(restored.$from.parent.attrs.id).toBe('b');
  });

  it('moves a non-text block’s endpoint to the nearest text position', () => {
    const before = doc(
      block('paragraph', 'a', 'Hello'),
      block('paragraph', 'b', 'BBBB'),
    );
    const selection = TextSelection.create(
      before,
      startOf(before, 'a') + 2,
      startOf(before, 'a') + 4,
    );

    // The paragraph with id 'a' became an atom (a chart): its old numeric
    // position is between blocks, so both endpoints must land in a textblock.
    const after = doc(block('chart', 'a'), block('paragraph', 'b', 'BBBB'));
    const restored = restoreTextSelection(selection, after);

    expect(restored.from).toBe(startOf(after, 'b'));
    expect(restored.to).toBe(startOf(after, 'b'));
    expect(restored.$from.parent.attrs.id).toBe('b');
    expect(restored.$to.parent.attrs.id).toBe('b');
  });

  it('keeps the caret inside a list when the list moves', () => {
    const before = doc(
      listBlock('list', 'First item'),
      block('paragraph', 'b', 'BBBB'),
    );
    const selection = TextSelection.create(before, startOf(before, 'list') + 2);

    // The list is a container of editable paragraphs, not an atom: the old
    // caret offset must map inside the moved list, not after it.
    const after = doc(
      block('paragraph', 'prefix', 'P'),
      listBlock('list', 'First item'),
      block('paragraph', 'b', 'BBBB'),
    );
    const restored = restoreTextSelection(selection, after);

    expect(restored.$from.node(1).attrs.id).toBe('list');
    expect(restored.from).toBe(startOf(after, 'list') + 2);
  });

  it('skips adjacent charts to reach the next text block', () => {
    const before = doc(
      block('paragraph', 'a', 'Hello'),
      block('paragraph', 'b', 'BBBB'),
    );
    const selection = TextSelection.create(before, startOf(before, 'a') + 2);

    // 'a' became a chart directly before another chart. Both `Selection.near`
    // directions from between them would return node selections; the text
    // search must skip both charts and land in 'c'.
    const after = doc(
      block('chart', 'a'),
      block('chart', 'b'),
      block('paragraph', 'c', 'CCCC'),
    );
    const restored = restoreTextSelection(selection, after);

    expect(restored.from).toBe(startOf(after, 'c'));
    expect(restored.$from.parent.attrs.id).toBe('c');
  });

  it('returns a valid non-text selection when no textblock remains', () => {
    const before = doc(block('paragraph', 'a', 'Hello'), block('chart', 'b'));
    const selection = TextSelection.create(before, startOf(before, 'a') + 2);

    const after = doc(block('chart', 'a'), block('chart', 'b'));
    const restored = restoreTextSelection(selection, after);

    expect(restored).not.toBeInstanceOf(TextSelection);
    expect(restored.from).toBeGreaterThanOrEqual(0);
    expect(restored.from).toBeLessThanOrEqual(after.content.size);
  });

  it('falls back to the nearest text position when the block is gone', () => {
    const before = doc(
      block('title', null, 'Title'),
      block('paragraph', 'removed', 'Hello'),
    );
    const selection = TextSelection.create(before, startOf(before, 'removed'));

    const after = doc(block('title', null, 'Title'));
    const restored = restoreTextSelection(selection, after);

    expect(restored.from).toBeLessThanOrEqual(after.content.size);
    expect(restored.$from.parent.type.name).toBe('title');
  });
});
