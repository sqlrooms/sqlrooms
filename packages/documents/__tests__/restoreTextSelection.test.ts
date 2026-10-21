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
    text: {},
  },
});

function block(type: string, id: string | null, text = '') {
  return schema.node(type, {id}, text ? schema.text(text) : undefined);
}

function doc(...blocks: ProseMirrorNode[]) {
  return schema.node('doc', null, blocks);
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

  it('falls back to numeric offsets when the block is gone', () => {
    const before = doc(
      block('title', null, 'Title'),
      block('paragraph', 'removed', 'Hello'),
    );
    const selection = TextSelection.create(before, startOf(before, 'removed'));

    const after = doc(block('title', null, 'Title'));
    const restored = restoreTextSelection(selection, after);

    expect(restored.from).toBeLessThanOrEqual(after.content.size);
  });
});
